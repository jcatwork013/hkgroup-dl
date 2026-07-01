//go:build integration

package withdrawal

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

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

// seedAffiliateWithCommission tạo user + nạp số dư hoa hồng qua journal.
func seedAffiliateWithCommission(t *testing.T, d *pdb.DB, amount money.VND) string {
	t.Helper()
	id := uuid.NewString()
	_, err := d.Pool.Exec(context.Background(),
		`INSERT INTO users(id,email,password_hash,full_name) VALUES($1,$2,'x','aff')`,
		id, fmt.Sprintf("aff-%s@t.local", id[:8]))
	if err != nil {
		t.Fatal(err)
	}
	err = d.WithTx(context.Background(), func(tx pgx.Tx) error {
		j := ledger.NewJournal("test_seed", id, "nạp hoa hồng")
		j.Debit(ledger.WalletRef{Kind: ledger.KindRevenue}, amount)
		j.Credit(ledger.WalletRef{Kind: ledger.KindCommission, OwnerID: id}, amount)
		_, e := ledger.PostJournal(context.Background(), tx, *j)
		return e
	})
	if err != nil {
		t.Fatalf("nạp hoa hồng: %v", err)
	}
	return id
}

func inWindow() time.Time  { return time.Date(2026, 6, 20, 9, 0, 0, 0, time.UTC) }
func outWindow() time.Time { return time.Date(2026, 6, 5, 9, 0, 0, 0, time.UTC) }

func commBal(t *testing.T, d *pdb.DB, uid string) money.VND {
	t.Helper()
	b, _ := ledger.Balance(context.Background(), d.Pool, ledger.WalletRef{Kind: ledger.KindCommission, OwnerID: uid})
	return b
}

func TestWithdrawal_FullFlow_Pay(t *testing.T) {
	d := testDB(t)
	defer d.Close()
	ctx := context.Background()
	svc := NewService(d, d.Pool, DefaultWindow())

	uid := seedAffiliateWithCommission(t, d, 1_000_000)
	admin := uuid.NewString()

	// Available = 1tr.
	if av, _ := svc.Available(ctx, d.Pool, uid); av != 1_000_000 {
		t.Fatalf("available = %d, want 1tr", av)
	}

	// Request 400k trong cửa sổ.
	wid, err := svc.Request(ctx, uid, 400_000, "123", "VCB", inWindow())
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	// Available giảm còn 600k (đã khóa 400k).
	if av, _ := svc.Available(ctx, d.Pool, uid); av != 600_000 {
		t.Fatalf("available sau khóa = %d, want 600k", av)
	}

	// Approve -> Pay.
	if err := svc.Approve(ctx, wid, admin); err != nil {
		t.Fatalf("approve: %v", err)
	}
	if err := svc.Pay(ctx, wid, admin); err != nil {
		t.Fatalf("pay: %v", err)
	}
	// Số dư hoa hồng giảm 400k.
	if b := commBal(t, d, uid); b != 600_000 {
		t.Fatalf("commission sau chi = %d, want 600k", b)
	}
	// Pay lần 2 idempotent: không double-debit.
	if err := svc.Pay(ctx, wid, admin); err != nil {
		t.Fatalf("pay lần 2: %v", err)
	}
	if b := commBal(t, d, uid); b != 600_000 {
		t.Fatalf("DOUBLE-DEBIT: commission = %d, want 600k", b)
	}
}

func TestWithdrawal_OnePendingLock(t *testing.T) {
	d := testDB(t)
	defer d.Close()
	ctx := context.Background()
	svc := NewService(d, d.Pool, DefaultWindow())
	uid := seedAffiliateWithCommission(t, d, 1_000_000)

	if _, err := svc.Request(ctx, uid, 100_000, "1", "VCB", inWindow()); err != nil {
		t.Fatalf("request 1: %v", err)
	}
	// Yêu cầu thứ 2 khi đang chờ -> chặn.
	_, err := svc.Request(ctx, uid, 100_000, "1", "VCB", inWindow())
	if !errors.Is(err, ErrAlreadyPending) {
		t.Fatalf("phải chặn yêu cầu thứ 2, got %v", err)
	}
}

func TestWithdrawal_Validations(t *testing.T) {
	d := testDB(t)
	defer d.Close()
	ctx := context.Background()
	svc := NewService(d, d.Pool, DefaultWindow())

	// Ngoài cửa sổ.
	u1 := seedAffiliateWithCommission(t, d, 1_000_000)
	if _, err := svc.Request(ctx, u1, 100_000, "1", "VCB", outWindow()); !errors.Is(err, ErrOutsideWindow) {
		t.Fatalf("ngoài cửa sổ phải lỗi, got %v", err)
	}

	// Rút quá số dư.
	u2 := seedAffiliateWithCommission(t, d, 100_000)
	if _, err := svc.Request(ctx, u2, 200_000, "1", "VCB", inWindow()); !errors.Is(err, ErrInsufficient) {
		t.Fatalf("rút quá số dư phải lỗi, got %v", err)
	}
}

func TestWithdrawal_RejectReleasesHold(t *testing.T) {
	d := testDB(t)
	defer d.Close()
	ctx := context.Background()
	svc := NewService(d, d.Pool, DefaultWindow())
	uid := seedAffiliateWithCommission(t, d, 1_000_000)

	wid, err := svc.Request(ctx, uid, 500_000, "1", "VCB", inWindow())
	if err != nil {
		t.Fatal(err)
	}
	if av, _ := svc.Available(ctx, d.Pool, uid); av != 500_000 {
		t.Fatalf("available khi đang khóa = %d, want 500k", av)
	}
	if err := svc.Reject(ctx, wid, uuid.NewString(), "thiếu thông tin"); err != nil {
		t.Fatalf("reject: %v", err)
	}
	// Hold được nhả -> available về 1tr; số dư ledger không đổi.
	if av, _ := svc.Available(ctx, d.Pool, uid); av != 1_000_000 {
		t.Fatalf("available sau reject = %d, want 1tr", av)
	}
	if b := commBal(t, d, uid); b != 1_000_000 {
		t.Fatalf("ledger không được đổi khi reject: %d", b)
	}
}
