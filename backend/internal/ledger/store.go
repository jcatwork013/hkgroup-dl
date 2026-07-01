package ledger

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/hkgroup/backend/internal/money"
)

// Querier là giao diện chung cho *pgxpool.Pool và pgx.Tx — cho phép gọi trong/ngoài transaction.
// Đường ghi tiền LUÔN truyền pgx.Tx (BẤT BIẾN #5).
type Querier interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// PostJournal là HELPER "post a balanced journal" (T0): validate Σ debit=Σ credit TRƯỚC,
// rồi ghi toàn bộ entry với cùng journal_id. Trả về journal_id để truy vết/đảo sau này.
// Gọi trong 1 transaction để đảm bảo nguyên tử.
func PostJournal(ctx context.Context, q Querier, j Journal) (string, error) {
	return PostJournalWithID(ctx, q, j, uuid.NewString())
}

// PostJournalWithID như PostJournal nhưng dùng journal_id cho trước — cần khi caller phải
// chốt journal_id vào bảng idempotent (vd order_allocations) TRƯỚC khi ghi entry.
func PostJournalWithID(ctx context.Context, q Querier, j Journal, jid string) (string, error) {
	if err := j.Validate(); err != nil {
		return "", err // reject mọi journal lệch — không bao giờ ghi sổ không cân bằng
	}
	for _, e := range j.Entries {
		wid, err := walletID(ctx, q, e.Wallet)
		if err != nil {
			return "", fmt.Errorf("resolve ví %s: %w", e.Wallet, err)
		}
		if _, err := q.Exec(ctx,
			`INSERT INTO ledger_entries(journal_id, wallet_id, direction, amount, ref_type, ref_id, memo)
			 VALUES($1,$2,$3,$4,$5,$6,$7)`,
			jid, wid, string(e.Direction), e.Amount.Int64(), j.RefType, j.RefID, j.Memo,
		); err != nil {
			return "", fmt.Errorf("ghi entry: %w", err)
		}
	}
	return jid, nil
}

// walletID resolve (kind, owner) -> id, tạo nếu chưa có. Idempotent dưới race nhờ ON CONFLICT.
func walletID(ctx context.Context, q Querier, ref WalletRef) (int64, error) {
	var id int64
	var err error
	if ref.IsSystem() {
		err = q.QueryRow(ctx, `SELECT id FROM wallets WHERE kind=$1 AND owner_id IS NULL`, string(ref.Kind)).Scan(&id)
	} else {
		err = q.QueryRow(ctx, `SELECT id FROM wallets WHERE kind=$1 AND owner_id=$2`, string(ref.Kind), ref.OwnerID).Scan(&id)
	}
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return 0, err
	}
	// Chưa có -> tạo (an toàn dưới đồng thời nhờ partial unique index + ON CONFLICT).
	if ref.IsSystem() {
		err = q.QueryRow(ctx,
			`INSERT INTO wallets(kind, owner_id) VALUES($1, NULL)
			 ON CONFLICT (kind) WHERE owner_id IS NULL DO UPDATE SET kind=wallets.kind
			 RETURNING id`, string(ref.Kind)).Scan(&id)
	} else {
		err = q.QueryRow(ctx,
			`INSERT INTO wallets(kind, owner_id) VALUES($1, $2)
			 ON CONFLICT (kind, owner_id) WHERE owner_id IS NOT NULL DO UPDATE SET kind=wallets.kind
			 RETURNING id`, string(ref.Kind), ref.OwnerID).Scan(&id)
	}
	return id, err
}

// Balance trả về số dư ví = SUM(credit) − SUM(debit) (BẤT BIẾN #2, không cache).
func Balance(ctx context.Context, q Querier, ref WalletRef) (money.VND, error) {
	var bal int64
	var err error
	const expr = `COALESCE(SUM(CASE WHEN le.direction='credit' THEN le.amount ELSE -le.amount END),0)`
	if ref.IsSystem() {
		err = q.QueryRow(ctx,
			`SELECT `+expr+` FROM ledger_entries le JOIN wallets w ON w.id=le.wallet_id
			 WHERE w.kind=$1 AND w.owner_id IS NULL`, string(ref.Kind)).Scan(&bal)
	} else {
		err = q.QueryRow(ctx,
			`SELECT `+expr+` FROM ledger_entries le JOIN wallets w ON w.id=le.wallet_id
			 WHERE w.kind=$1 AND w.owner_id=$2`, string(ref.Kind), ref.OwnerID).Scan(&bal)
	}
	if err != nil {
		return 0, err
	}
	return money.VND(bal), nil
}

// CountEntries đếm số entry theo ref — tiện cho test idempotency (chạy 2 lần không tăng entry).
func CountEntries(ctx context.Context, q Querier, refType, refID string) (int, error) {
	var n int
	err := q.QueryRow(ctx, `SELECT COUNT(*) FROM ledger_entries WHERE ref_type=$1 AND ref_id=$2`, refType, refID).Scan(&n)
	return n, err
}
