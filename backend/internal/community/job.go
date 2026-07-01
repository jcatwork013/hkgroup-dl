package community

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/hkgroup/backend/internal/ledger"
	"github.com/hkgroup/backend/internal/money"
)

// SalesBasis: trọng số doanh số tính theo KỲ hay LŨY KẾ.
// ⚠️ SPEC CÒN TRỐNG — mặc định PerPeriod; phải XÁC NHẬN với chủ dự án trước khi chạy thật.
type SalesBasis string

const (
	BasisPerPeriod  SalesBasis = "per_period" // doanh số trong tháng
	BasisCumulative SalesBasis = "cumulative" // lũy kế tới hết tháng
)

type Config struct {
	EligibleMinVND money.VND  // ngưỡng đủ điều kiện (mặc định 1.000.000đ)
	Basis          SalesBasis // mặc định BasisPerPeriod (cần xác nhận)
}

func DefaultConfig() Config {
	return Config{EligibleMinVND: 1_000_000, Basis: BasisPerPeriod}
}

type TxRunner interface {
	WithTx(ctx context.Context, fn func(tx pgx.Tx) error) error
	// Pool truy vấn read-only ngoài tx.
}

// Job đóng kỳ Quỹ Đồng Chia.
type Job struct {
	db  *pgxAdapter
	cfg Config
}

// pgxAdapter gói cả WithTx lẫn 1 Querier để đọc tổng hợp ngoài tx.
type pgxAdapter struct {
	tx   TxRunner
	read ledger.Querier
}

func NewJob(tx TxRunner, read ledger.Querier, cfg Config) *Job {
	return &Job{db: &pgxAdapter{tx: tx, read: read}, cfg: cfg}
}

// monthBounds trả [start, end) cho period_key "YYYY-MM".
func monthBounds(periodKey string) (time.Time, time.Time, error) {
	start, err := time.Parse("2006-01", periodKey)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("period_key phải dạng YYYY-MM: %w", err)
	}
	return start, start.AddDate(0, 1, 0), nil
}

// JobResult tóm tắt kết quả đóng kỳ.
type JobResult struct {
	PeriodID    string
	Pool        money.VND
	Distributed money.VND
	Leftover    money.VND
	Count       int
}

// CloseMonth đóng 1 kỳ: tính pool, lọc eligible, phân phối ĐIỂM idempotent.
// Idempotent: chạy lại cùng period_key KHÔNG phát điểm lần 2 (UNIQUE period_id+customer_id).
func (j *Job) CloseMonth(ctx context.Context, periodKey string) (JobResult, error) {
	start, end, err := monthBounds(periodKey)
	if err != nil {
		return JobResult{}, err
	}

	// 1) Tạo/đọc period (open).
	var periodID string
	err = j.db.read.QueryRow(ctx,
		`INSERT INTO community_periods(period_key) VALUES($1)
		 ON CONFLICT (period_key) DO UPDATE SET period_key=community_periods.period_key
		 RETURNING id`, periodKey).Scan(&periodID)
	if err != nil {
		return JobResult{}, fmt.Errorf("tạo period: %w", err)
	}

	// 2) pool = Σ credit ví community_pool trong kỳ.
	var poolI int64
	if err := j.db.read.QueryRow(ctx,
		`SELECT COALESCE(SUM(le.amount),0) FROM ledger_entries le
		   JOIN wallets w ON w.id=le.wallet_id
		 WHERE w.kind='community_pool' AND w.owner_id IS NULL AND le.direction='credit'
		   AND le.created_at >= $1 AND le.created_at < $2`, start, end).Scan(&poolI); err != nil {
		return JobResult{}, fmt.Errorf("tính pool: %w", err)
	}
	pool := money.VND(poolI)

	// 3) Eligible + doanh số (theo basis).
	eligibles, err := j.loadEligibles(ctx, start, end)
	if err != nil {
		return JobResult{}, err
	}

	// 4) Tính phân phối (pure).
	res := Distribute(pool, eligibles)

	// 5) Ghi sổ từng khách idempotent.
	for _, dist := range res.Distributions {
		if err := j.postOne(ctx, periodID, dist); err != nil {
			return JobResult{}, err
		}
	}

	// 6) Cập nhật tổng kết + đóng kỳ.
	if _, err := j.db.read.Exec(ctx,
		`UPDATE community_periods SET pool_vnd=$2, distributed_vnd=$3, leftover_vnd=$4,
		   status='closed', closed_at=now() WHERE id=$1`,
		periodID, pool.Int64(), res.Distributed.Int64(), res.Leftover.Int64()); err != nil {
		return JobResult{}, fmt.Errorf("đóng kỳ: %w", err)
	}

	return JobResult{PeriodID: periodID, Pool: pool, Distributed: res.Distributed,
		Leftover: res.Leftover, Count: len(res.Distributions)}, nil
}

func (j *Job) loadEligibles(ctx context.Context, start, end time.Time) ([]Eligible, error) {
	// PerPeriod: doanh số đơn COMPLETED trong [start,end).
	// Cumulative: bỏ cận dưới (tính tới hết kỳ). ⚠️ chốt spec trước khi dùng cumulative.
	var rows pgx.Rows
	var err error
	switch j.cfg.Basis {
	case BasisCumulative:
		rows, err = j.db.read.Query(ctx,
			`SELECT customer_id, SUM(total_vnd) FROM orders
			 WHERE status='COMPLETED' AND completed_at < $1
			 GROUP BY customer_id HAVING SUM(total_vnd) >= $2`, end, j.cfg.EligibleMinVND.Int64())
	default:
		rows, err = j.db.read.Query(ctx,
			`SELECT customer_id, SUM(total_vnd) FROM orders
			 WHERE status='COMPLETED' AND completed_at >= $1 AND completed_at < $2
			 GROUP BY customer_id HAVING SUM(total_vnd) >= $3`, start, end, j.cfg.EligibleMinVND.Int64())
	}
	if err != nil {
		return nil, fmt.Errorf("đọc eligible: %w", err)
	}
	defer rows.Close()
	var out []Eligible
	for rows.Next() {
		var id string
		var sales int64
		if err := rows.Scan(&id, &sales); err != nil {
			return nil, err
		}
		out = append(out, Eligible{CustomerID: id, Sales: money.VND(sales)})
	}
	return out, rows.Err()
}

// postOne ghi điểm cho 1 khách trong 1 tx, idempotent theo (period, customer).
func (j *Job) postOne(ctx context.Context, periodID string, d Distribution) error {
	return j.db.tx.WithTx(ctx, func(tx pgx.Tx) error {
		jid := uuid.NewString()
		tag, err := tx.Exec(ctx,
			`INSERT INTO community_distributions(period_id, customer_id, sales_vnd, points, journal_id)
			 VALUES($1,$2,0,$3,$4) ON CONFLICT (period_id, customer_id) DO NOTHING`,
			periodID, d.CustomerID, d.Points.Int64(), jid)
		if err != nil {
			return fmt.Errorf("chốt distribution: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return nil // đã phát điểm kỳ này cho khách -> bỏ qua
		}
		// Journal: DEBIT community_pool, CREDIT ví điểm khách.
		jr := ledger.NewJournal("community", periodID+":"+d.CustomerID, "phát điểm Quỹ Đồng Chia")
		jr.Debit(ledger.WalletRef{Kind: ledger.KindCommunityPool}, d.Points)
		jr.Credit(ledger.WalletRef{Kind: ledger.KindPoint, OwnerID: d.CustomerID}, d.Points)
		if _, err := ledger.PostJournalWithID(ctx, tx, *jr, jid); err != nil {
			return err
		}
		return nil
	})
}

var ErrClosedPeriod = errors.New("community: kỳ đã đóng")
