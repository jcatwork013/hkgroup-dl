package allocation

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/hkgroup/backend/internal/ledger"
	"github.com/hkgroup/backend/internal/money"
)

// Config gom toàn bộ tỷ lệ (cấu hình qua env, KHÔNG hardcode rải rác).
type Config struct {
	AffiliateBPS   int64
	CommunityBPS   int64
	ShareholderBPS int64
	HubRateBPS     map[int]int64 // level (1/2/3) -> bps
}

// DefaultConfig theo spec: aff 10%, comm 5%, share 15%; hub L1/L2/L3 = 15/20/25%.
func DefaultConfig() Config {
	return Config{
		AffiliateBPS:   1000,
		CommunityBPS:   500,
		ShareholderBPS: 1500,
		HubRateBPS:     map[int]int64{1: 1500, 2: 2000, 3: 2500},
	}
}

// TxRunner là khả năng chạy 1 hàm trong transaction (do platform/db cung cấp).
type TxRunner interface {
	WithTx(ctx context.Context, fn func(tx pgx.Tx) error) error
}

// Engine thực thi phân bổ doanh thu khi đơn COMPLETED.
type Engine struct {
	db  TxRunner
	cfg Config
}

func NewEngine(db TxRunner, cfg Config) *Engine { return &Engine{db: db, cfg: cfg} }

// Result của 1 lần Run.
type Result struct {
	Allocated   bool      // true nếu LẦN NÀY thực sự phân bổ (false nếu đã phân bổ trước đó)
	Split       Split     // số tiền từng phần
	ShareAmount money.VND // = Split.Shareholder, để worker phát "shareholder.allocate"
	JournalID   string
}

var ErrOrderNotCompleted = errors.New("allocation: chỉ phân bổ đơn ở trạng thái COMPLETED")

// Run phân bổ cho 1 đơn. IDEMPOTENT TUYỆT ĐỐI theo order_id:
//   - gate qua INSERT order_allocations ON CONFLICT DO NOTHING;
//   - nếu không insert được (đã có) -> trả Allocated=false, KHÔNG post journal lần 2.
//
// Toàn bộ trong 1 transaction (BẤT BIẾN #5). Dưới đồng thời, PK order_id serialize đúng.
func (e *Engine) Run(ctx context.Context, orderID string) (Result, error) {
	var res Result
	err := e.db.WithTx(ctx, func(tx pgx.Tx) error {
		// 1) Khóa đơn + đọc dữ kiện.
		var (
			total       int64
			affiliateID *string
			hubID       *string
			status      string
		)
		err := tx.QueryRow(ctx,
			`SELECT total_vnd, affiliate_id, hub_id, status FROM orders WHERE id=$1 FOR UPDATE`,
			orderID).Scan(&total, &affiliateID, &hubID, &status)
		if err != nil {
			return fmt.Errorf("đọc đơn: %w", err)
		}
		if status != "COMPLETED" {
			return ErrOrderNotCompleted
		}

		// 2) Resolve hub rate theo level (0 nếu không gán hub).
		hubBps := int64(0)
		if hubID != nil {
			var level int
			if err := tx.QueryRow(ctx, `SELECT level FROM hubs WHERE id=$1`, *hubID).Scan(&level); err != nil {
				return fmt.Errorf("đọc hub level: %w", err)
			}
			hubBps = e.cfg.HubRateBPS[level] // 0 nếu level lạ -> phần dư về company, vẫn cân
		}

		hasAffiliate := affiliateID != nil
		split, err := Allocate(money.VND(total), hasAffiliate, Params{
			AffiliateBPS:   e.cfg.AffiliateBPS,
			HubBPS:         hubBps,
			CommunityBPS:   e.cfg.CommunityBPS,
			ShareholderBPS: e.cfg.ShareholderBPS,
		})
		if err != nil {
			return err
		}

		// 3) GATE idempotent: chốt order_allocations TRƯỚC khi ghi sổ.
		jid := uuid.NewString()
		tag, err := tx.Exec(ctx,
			`INSERT INTO order_allocations
			   (order_id, total_vnd, affiliate_vnd, hub_vnd, community_vnd, shareholder_vnd, company_vnd, journal_id)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			 ON CONFLICT (order_id) DO NOTHING`,
			orderID, total, split.Affiliate.Int64(), split.Hub.Int64(), split.Community.Int64(),
			split.Shareholder.Int64(), split.Company.Int64(), jid)
		if err != nil {
			return fmt.Errorf("chốt order_allocations: %w", err)
		}
		if tag.RowsAffected() == 0 {
			// Đã phân bổ trước đó -> no-op, KHÔNG post journal lần 2.
			res.Allocated = false
			return nil
		}

		// 4) Post journal cân bằng (revenue debit = Σ credit stakeholders).
		j := allocationJournal(orderID, money.VND(total), split, affiliateID, hubID)
		if _, err := ledger.PostJournalWithID(ctx, tx, j, jid); err != nil {
			return err
		}

		// 5) Audit (BẤT BIẾN #8).
		if err := writeAudit(ctx, tx, orderID, "order.allocated", split); err != nil {
			return err
		}

		res.Allocated = true
		res.Split = split
		res.ShareAmount = split.Shareholder
		res.JournalID = jid
		return nil
	})
	return res, err
}

// allocationJournal dựng journal cân bằng cho 1 đơn.
//
//	DEBIT  revenue           total
//	CREDIT affiliate         aff      (nếu có affiliate)
//	CREDIT hub commission    hub      (nếu có hub)
//	CREDIT community_pool     comm
//	CREDIT shareholder_pool   share
//	CREDIT company           company  (phần còn lại)
func allocationJournal(orderID string, total money.VND, s Split, affiliateID, hubID *string) ledger.Journal {
	j := ledger.NewJournal("order", orderID, "phân bổ doanh thu đơn COMPLETED")
	j.Debit(ledger.WalletRef{Kind: ledger.KindRevenue}, total)
	if affiliateID != nil {
		j.Credit(ledger.WalletRef{Kind: ledger.KindCommission, OwnerID: *affiliateID}, s.Affiliate)
	}
	if hubID != nil {
		j.Credit(ledger.WalletRef{Kind: ledger.KindCommission, OwnerID: *hubID}, s.Hub)
	}
	j.Credit(ledger.WalletRef{Kind: ledger.KindCommunityPool}, s.Community)
	j.Credit(ledger.WalletRef{Kind: ledger.KindShareholderPool}, s.Shareholder)
	j.Credit(ledger.WalletRef{Kind: ledger.KindCompany}, s.Company)
	return *j
}

// Reverse ghi BÚT TOÁN ĐẢO khi đơn REFUNDED sau khi đã phân bổ (BẤT BIẾN #6).
// Idempotent: chỉ đảo 1 lần (reversed_at IS NULL). KHÔNG xóa/sửa entry cũ.
func (e *Engine) Reverse(ctx context.Context, orderID string) (bool, error) {
	reversed := false
	err := e.db.WithTx(ctx, func(tx pgx.Tx) error {
		var (
			total                                                int64
			aff, hub, comm, share, company                       int64
			alreadyReversed                                      bool
			affiliateID, hubID                                   *string
		)
		err := tx.QueryRow(ctx,
			`SELECT total_vnd, affiliate_vnd, hub_vnd, community_vnd, shareholder_vnd, company_vnd,
			        (reversed_at IS NOT NULL)
			 FROM order_allocations WHERE order_id=$1 FOR UPDATE`,
			orderID).Scan(&total, &aff, &hub, &comm, &share, &company, &alreadyReversed)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil // chưa từng phân bổ -> không có gì để đảo
		}
		if err != nil {
			return fmt.Errorf("đọc allocation: %w", err)
		}
		if alreadyReversed {
			return nil // đã đảo rồi -> idempotent
		}
		// Lấy lại owner để đảo đúng ví.
		if err := tx.QueryRow(ctx, `SELECT affiliate_id, hub_id FROM orders WHERE id=$1`, orderID).
			Scan(&affiliateID, &hubID); err != nil {
			return fmt.Errorf("đọc đơn: %w", err)
		}

		split := Split{Affiliate: money.VND(aff), Hub: money.VND(hub), Community: money.VND(comm),
			Shareholder: money.VND(share), Company: money.VND(company)}
		orig := allocationJournal(orderID, money.VND(total), split, affiliateID, hubID)
		rev := orig.Reversed("order_refund", orderID, "đảo phân bổ do REFUNDED")

		jid := uuid.NewString()
		if _, err := ledger.PostJournalWithID(ctx, tx, rev, jid); err != nil {
			return err
		}
		tag, err := tx.Exec(ctx,
			`UPDATE order_allocations SET reversed_at=now(), reversal_journal_id=$2
			 WHERE order_id=$1 AND reversed_at IS NULL`, orderID, jid)
		if err != nil {
			return fmt.Errorf("đánh dấu reversed: %w", err)
		}
		if tag.RowsAffected() == 1 {
			reversed = true
			_ = writeAudit(ctx, tx, orderID, "order.reversed", split)
		}
		return nil
	})
	return reversed, err
}

func writeAudit(ctx context.Context, tx pgx.Tx, orderID, action string, s Split) error {
	_, err := tx.Exec(ctx,
		`INSERT INTO audit_log(actor_role, action, entity_type, entity_id, data)
		 VALUES('system',$1,'order',$2,
		   jsonb_build_object('affiliate',$3::bigint,'hub',$4::bigint,'community',$5::bigint,
		     'shareholder',$6::bigint,'company',$7::bigint))`,
		action, orderID, s.Affiliate.Int64(), s.Hub.Int64(), s.Community.Int64(),
		s.Shareholder.Int64(), s.Company.Int64())
	return err
}
