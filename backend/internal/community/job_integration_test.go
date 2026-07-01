//go:build integration

package community

import (
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/hkgroup/backend/internal/ledger"
	"github.com/hkgroup/backend/internal/money"
	pdb "github.com/hkgroup/backend/internal/platform/db"
)

func testDB(t *testing.T) *pdb.DB {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		url = "postgres://hk:hk@localhost:5441/hkgroup?sslmode=disable"
	}
	d, err := pdb.Connect(context.Background(), url)
	if err != nil {
		t.Skipf("không kết nối được DB (%v)", err)
	}
	return d
}

func seedCustomer(t *testing.T, d *pdb.DB) string {
	t.Helper()
	id := uuid.NewString()
	_, err := d.Pool.Exec(context.Background(),
		`INSERT INTO users(id,email,password_hash,full_name) VALUES($1,$2,'x','c')`,
		id, fmt.Sprintf("cust-%s@t.local", id[:8]))
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func seedCompletedOrderNow(t *testing.T, d *pdb.DB, customerID string, total int64) {
	t.Helper()
	id := uuid.NewString()
	_, err := d.Pool.Exec(context.Background(),
		`INSERT INTO orders(id,code,customer_id,status,total_vnd,completed_at)
		 VALUES($1,$2,$3,'COMPLETED',$4,now())`, id, "O-"+id[:8], customerID, total)
	if err != nil {
		t.Fatal(err)
	}
}

func currentPeriod(t *testing.T, d *pdb.DB) string {
	t.Helper()
	var pk string
	if err := d.Pool.QueryRow(context.Background(), `SELECT to_char(now(),'YYYY-MM')`).Scan(&pk); err != nil {
		t.Fatal(err)
	}
	return pk
}

// Nạp pool vào ví community_pool bằng 1 journal cân bằng (DEBIT revenue, CREDIT pool).
func fundPool(t *testing.T, d *pdb.DB, amount money.VND, tag string) {
	t.Helper()
	err := d.WithTx(context.Background(), func(tx pgx.Tx) error {
		j := ledger.NewJournal("test_fund", tag, "nạp pool test")
		j.Debit(ledger.WalletRef{Kind: ledger.KindRevenue}, amount)
		j.Credit(ledger.WalletRef{Kind: ledger.KindCommunityPool}, amount)
		_, err := ledger.PostJournal(context.Background(), tx, *j)
		return err
	})
	if err != nil {
		t.Fatalf("fund pool: %v", err)
	}
}

// T8 DoD: Σ điểm <= pool; chạy lại cùng kỳ KHÔNG phát 2 lần.
func TestCommunityJob_DistributesAndIdempotent(t *testing.T) {
	d := testDB(t)
	defer d.Close()
	ctx := context.Background()

	// pool ròng của kỳ = balance community_pool trước test (đảm bảo đo delta đúng).
	job := NewJob(d, d.Pool, DefaultConfig())
	period := currentPeriod(t, d)

	c1 := seedCustomer(t, d)
	c2 := seedCustomer(t, d)
	c3 := seedCustomer(t, d) // dưới ngưỡng -> không eligible
	seedCompletedOrderNow(t, d, c1, 3_000_000)
	seedCompletedOrderNow(t, d, c2, 1_000_000)
	seedCompletedOrderNow(t, d, c3, 500_000) // < 1tr

	poolFund := money.VND(1_000_000)
	fundPool(t, d, poolFund, uuid.NewString())

	// Lần 1.
	res, err := job.CloseMonth(ctx, period)
	if err != nil {
		t.Fatalf("close: %v", err)
	}
	if res.Distributed > res.Pool {
		t.Fatalf("Σ điểm %d vượt pool %d", res.Distributed, res.Pool)
	}
	// c3 không eligible -> không có điểm.
	if pts := pointBalance(t, d, c3); pts != 0 {
		t.Fatalf("c3 dưới ngưỡng nhưng có %d điểm", pts)
	}
	// c1 và c2 có điểm > 0, c1 > c2 (doanh số cao hơn).
	p1, p2 := pointBalance(t, d, c1), pointBalance(t, d, c2)
	if p1 <= 0 || p2 <= 0 || p1 <= p2 {
		t.Fatalf("phân bổ sai tỷ lệ: c1=%d c2=%d", p1, p2)
	}

	// Lần 2 (idempotent) — điểm KHÔNG đổi.
	if _, err := job.CloseMonth(ctx, period); err != nil {
		t.Fatalf("close lần 2: %v", err)
	}
	if pointBalance(t, d, c1) != p1 || pointBalance(t, d, c2) != p2 {
		t.Fatal("chạy lại phát điểm lần 2 — VI PHẠM IDEMPOTENT")
	}
}

func pointBalance(t *testing.T, d *pdb.DB, customerID string) money.VND {
	t.Helper()
	b, err := ledger.Balance(context.Background(), d.Pool, ledger.WalletRef{Kind: ledger.KindPoint, OwnerID: customerID})
	if err != nil {
		t.Fatal(err)
	}
	return b
}
