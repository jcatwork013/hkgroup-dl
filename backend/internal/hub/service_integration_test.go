//go:build integration

package hub

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"

	"github.com/google/uuid"

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
		t.Skipf("không kết nối DB (%v)", err)
	}
	return d
}

func seedHub(t *testing.T, d *pdb.DB) string {
	t.Helper()
	ctx := context.Background()
	owner := uuid.NewString()
	_, _ = d.Pool.Exec(ctx, `INSERT INTO users(id,email,password_hash) VALUES($1,$2,'x')`,
		owner, fmt.Sprintf("h-%s@t.local", owner[:8]))
	region := "RG" + uuid.NewString()[:6]
	_, _ = d.Pool.Exec(ctx, `INSERT INTO regions(code,name) VALUES($1,$1)`, region)
	id := uuid.NewString()
	_, err := d.Pool.Exec(ctx,
		`INSERT INTO hubs(id,owner_user_id,region_code,level,status) VALUES($1,$2,$3,1,'active')`,
		id, owner, region)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

// T7: nhập hàng vượt ngưỡng -> level tự lên.
func TestRecordPurchase_LevelUp(t *testing.T) {
	d := testDB(t)
	defer d.Close()
	ctx := context.Background()
	svc := NewService(d, DefaultThresholds())
	hub := seedHub(t, d)

	// Nhập 40tr -> vẫn L1.
	if lv, err := svc.RecordPurchase(ctx, hub, 40_000_000, "lần 1"); err != nil || lv != 1 {
		t.Fatalf("sau 40tr: lv=%d err=%v, want L1", lv, err)
	}
	// Nhập thêm 20tr (tổng 60tr) -> L2.
	if lv, err := svc.RecordPurchase(ctx, hub, 20_000_000, "lần 2"); err != nil || lv != 2 {
		t.Fatalf("sau 60tr: lv=%d err=%v, want L2", lv, err)
	}
	// Nhập thêm 50tr (tổng 110tr) -> L3.
	if lv, err := svc.RecordPurchase(ctx, hub, 50_000_000, "lần 3"); err != nil || lv != 3 {
		t.Fatalf("sau 110tr: lv=%d err=%v, want L3", lv, err)
	}
}

// T7: trừ kho không âm.
func TestStock_NoNegative(t *testing.T) {
	d := testDB(t)
	defer d.Close()
	ctx := context.Background()
	svc := NewService(d, DefaultThresholds())
	hub := seedHub(t, d)

	// tạo variant
	pid := uuid.NewString()
	vid := uuid.NewString()
	_, _ = d.Pool.Exec(ctx, `INSERT INTO products(id,slug,name,status) VALUES($1,$2,'sp','active')`, pid, "p-"+pid[:8])
	_, _ = d.Pool.Exec(ctx, `INSERT INTO product_variants(id,product_id,sku,price_vnd) VALUES($1,$2,$3,1000)`, vid, pid, "s-"+vid[:8])

	if err := svc.AddStock(ctx, hub, vid, 10); err != nil {
		t.Fatalf("add stock: %v", err)
	}
	if err := svc.DeductStock(ctx, hub, vid, 7); err != nil {
		t.Fatalf("deduct 7: %v", err)
	}
	// còn 3, trừ 5 -> phải lỗi, không âm.
	if err := svc.DeductStock(ctx, hub, vid, 5); !errors.Is(err, ErrInsufficientStock) {
		t.Fatalf("trừ quá tồn phải lỗi, got %v", err)
	}
	// còn đúng 3.
	var qty int
	_ = d.Pool.QueryRow(ctx, `SELECT qty FROM hub_inventory WHERE hub_id=$1 AND variant_id=$2`, hub, vid).Scan(&qty)
	if qty != 3 {
		t.Fatalf("qty=%d, want 3", qty)
	}
	_ = money.Zero // giữ import
}
