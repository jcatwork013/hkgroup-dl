//go:build integration

// Integration tests (cần Postgres). Chạy: make test-integration
// hoặc: go test -tags=integration ./internal/allocation/... -v
package allocation

import (
	"context"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"

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
		t.Skipf("không kết nối được DB (%v) — bỏ qua integration test", err)
	}
	return d
}

// seedUser tạo 1 user trả về id.
func seedUser(t *testing.T, d *pdb.DB, role string) string {
	t.Helper()
	id := uuid.NewString()
	email := fmt.Sprintf("%s-%s@test.local", role, id[:8])
	_, err := d.Pool.Exec(context.Background(),
		`INSERT INTO users(id,email,password_hash,full_name) VALUES($1,$2,'x',$3)`,
		id, email, role)
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return id
}

// seedHub tạo region + hub active level cho test.
func seedHub(t *testing.T, d *pdb.DB, ownerID string, level int) string {
	t.Helper()
	ctx := context.Background()
	region := "R" + uuid.NewString()[:6]
	if _, err := d.Pool.Exec(ctx, `INSERT INTO regions(code,name) VALUES($1,$1)`, region); err != nil {
		t.Fatalf("seed region: %v", err)
	}
	id := uuid.NewString()
	if _, err := d.Pool.Exec(ctx,
		`INSERT INTO hubs(id,owner_user_id,region_code,level,status) VALUES($1,$2,$3,$4,'active')`,
		id, ownerID, region, level); err != nil {
		t.Fatalf("seed hub: %v", err)
	}
	return id
}

// seedCompletedOrder tạo đơn COMPLETED. affiliateID/hubID có thể rỗng.
func seedCompletedOrder(t *testing.T, d *pdb.DB, total int64, customerID string, affiliateID, hubID *string) string {
	t.Helper()
	id := uuid.NewString()
	code := "ORD-" + id[:8]
	_, err := d.Pool.Exec(context.Background(),
		`INSERT INTO orders(id,code,customer_id,affiliate_id,hub_id,status,total_vnd,completed_at)
		 VALUES($1,$2,$3,$4,$5,'COMPLETED',$6,now())`,
		id, code, customerID, affiliateID, hubID, total)
	if err != nil {
		t.Fatalf("seed order: %v", err)
	}
	return id
}

// T4 DoD #1: chạy engine 2 lần cùng order -> ledger KHÔNG đổi (idempotent).
func TestEngine_Idempotent_RunTwice(t *testing.T) {
	d := testDB(t)
	defer d.Close()
	ctx := context.Background()
	eng := NewEngine(d, DefaultConfig())

	cust := seedUser(t, d, "customer")
	aff := seedUser(t, d, "affiliate")
	hubOwner := seedUser(t, d, "hub")
	hub := seedHub(t, d, hubOwner, 1) // L1 = 15%
	order := seedCompletedOrder(t, d, 1_000_000, cust, &aff, &hub)

	// Lần 1: phân bổ.
	r1, err := eng.Run(ctx, order)
	if err != nil {
		t.Fatalf("run1: %v", err)
	}
	if !r1.Allocated {
		t.Fatal("lần 1 phải Allocated=true")
	}
	// aff 100k, hub 150k, comm 50k, share 150k, company 550k
	want := Split{Affiliate: 100_000, Hub: 150_000, Community: 50_000, Shareholder: 150_000, Company: 550_000}
	if r1.Split != want {
		t.Fatalf("split = %+v, want %+v", r1.Split, want)
	}

	n1, _ := ledger.CountEntries(ctx, d.Pool, "order", order)

	// Lần 2: phải no-op.
	r2, err := eng.Run(ctx, order)
	if err != nil {
		t.Fatalf("run2: %v", err)
	}
	if r2.Allocated {
		t.Fatal("lần 2 phải Allocated=false (idempotent)")
	}
	n2, _ := ledger.CountEntries(ctx, d.Pool, "order", order)
	if n1 != n2 {
		t.Fatalf("ledger entries đổi sau lần 2: %d -> %d (DOUBLE-POST!)", n1, n2)
	}

	// Ví per-user: owner unique -> assert tuyệt đối, không bị nhiễu bởi test song song.
	assertBalance(t, ctx, d, ledger.WalletRef{Kind: ledger.KindCommission, OwnerID: aff}, 100_000)
	assertBalance(t, ctx, d, ledger.WalletRef{Kind: ledger.KindCommission, OwnerID: hub}, 150_000)
	// Phần community/shareholder đã được verify qua r1.Split == want ở trên (deterministic,
	// không assert balance ví hệ thống dùng chung để tránh nhiễu cross-package test).
}

// T4 DoD #2: 100 lần gọi SONG SONG cùng 1 order -> đúng 1 lần phân bổ, không double-post.
func TestEngine_Concurrent_SameOrder(t *testing.T) {
	d := testDB(t)
	defer d.Close()
	ctx := context.Background()
	eng := NewEngine(d, DefaultConfig())

	cust := seedUser(t, d, "customer")
	aff := seedUser(t, d, "affiliate")
	order := seedCompletedOrder(t, d, 777_777, cust, &aff, nil)

	const N = 100
	var allocatedCount int32
	var wg sync.WaitGroup
	errs := make(chan error, N)
	for i := 0; i < N; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r, err := eng.Run(ctx, order)
			if err != nil {
				errs <- err
				return
			}
			if r.Allocated {
				atomic.AddInt32(&allocatedCount, 1)
			}
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Fatalf("goroutine lỗi: %v", err)
	}
	if allocatedCount != 1 {
		t.Fatalf("phải đúng 1 lần Allocated=true, got %d (RACE/DOUBLE-POST!)", allocatedCount)
	}
	// Đúng 1 bộ entry: revenue debit + aff + comm + share + company = 5 entry.
	n, _ := ledger.CountEntries(ctx, d.Pool, "order", order)
	if n != 5 {
		t.Fatalf("số entry = %d, want 5 (1 bộ duy nhất)", n)
	}
}

// 100 đơn KHÁC NHAU song song -> company pool = Σ company của các đơn.
func TestEngine_Concurrent_DistinctOrders(t *testing.T) {
	d := testDB(t)
	defer d.Close()
	ctx := context.Background()
	eng := NewEngine(d, DefaultConfig())

	companyBefore := mustBalance(t, ctx, d, ledger.WalletRef{Kind: ledger.KindCompany})

	cust := seedUser(t, d, "customer")
	const N = 100
	orders := make([]string, N)
	var wantCompany money.VND
	for i := 0; i < N; i++ {
		total := int64(100_000 + i*1_000)
		orders[i] = seedCompletedOrder(t, d, total, cust, nil, nil) // không aff, không hub
		// không aff, không hub -> company = total - comm(5%) - share(15%)
		s, _ := Allocate(money.VND(total), false, Params{CommunityBPS: 500, ShareholderBPS: 1500})
		wantCompany = wantCompany.Add(s.Company)
	}

	var wg sync.WaitGroup
	for i := 0; i < N; i++ {
		wg.Add(1)
		go func(oid string) {
			defer wg.Done()
			if _, err := eng.Run(ctx, oid); err != nil {
				t.Errorf("run %s: %v", oid, err)
			}
		}(orders[i])
	}
	wg.Wait()

	companyAfter := mustBalance(t, ctx, d, ledger.WalletRef{Kind: ledger.KindCompany})
	if companyAfter.Sub(companyBefore) != wantCompany {
		t.Fatalf("company delta = %d, want %d", companyAfter.Sub(companyBefore), wantCompany)
	}
}

// BẤT BIẾN #6: refund -> bút toán đảo; số dư ròng của order về 0.
func TestEngine_Reverse_OnRefund(t *testing.T) {
	d := testDB(t)
	defer d.Close()
	ctx := context.Background()
	eng := NewEngine(d, DefaultConfig())

	cust := seedUser(t, d, "customer")
	aff := seedUser(t, d, "affiliate")
	order := seedCompletedOrder(t, d, 1_234_567, cust, &aff, nil)

	if _, err := eng.Run(ctx, order); err != nil {
		t.Fatalf("run: %v", err)
	}
	affBalAfterAlloc := mustBalance(t, ctx, d, ledger.WalletRef{Kind: ledger.KindCommission, OwnerID: aff})
	if affBalAfterAlloc <= 0 {
		t.Fatal("affiliate phải có hoa hồng sau phân bổ")
	}

	// Reverse.
	ok, err := eng.Reverse(ctx, order)
	if err != nil {
		t.Fatalf("reverse: %v", err)
	}
	if !ok {
		t.Fatal("reverse phải thành công lần đầu")
	}
	// Reverse lần 2 -> idempotent, không đổi.
	ok2, _ := eng.Reverse(ctx, order)
	if ok2 {
		t.Fatal("reverse lần 2 phải no-op (idempotent)")
	}

	// Số dư affiliate từ order này về 0 (credit rồi debit cùng lượng).
	affBalFinal := mustBalance(t, ctx, d, ledger.WalletRef{Kind: ledger.KindCommission, OwnerID: aff})
	if affBalFinal != 0 {
		t.Fatalf("sau reversal, affiliate phải = 0, got %d", affBalFinal)
	}
	// Entry KHÔNG bị xóa — phải tăng gấp đôi (gốc + đảo), KHÔNG sửa entry cũ.
	n, _ := ledger.CountEntries(ctx, d.Pool, "order", order)
	nrev, _ := ledger.CountEntries(ctx, d.Pool, "order_refund", order)
	if n == 0 || nrev == 0 || nrev != n {
		t.Fatalf("entry gốc=%d đảo=%d — phải cùng số và không bị xóa", n, nrev)
	}
}

func assertBalance(t *testing.T, ctx context.Context, d *pdb.DB, ref ledger.WalletRef, want money.VND) {
	t.Helper()
	got := mustBalance(t, ctx, d, ref)
	if got != want {
		t.Fatalf("balance %s = %d, want %d", ref, got, want)
	}
}

func mustBalance(t *testing.T, ctx context.Context, d *pdb.DB, ref ledger.WalletRef) money.VND {
	t.Helper()
	b, err := ledger.Balance(ctx, d.Pool, ref)
	if err != nil {
		t.Fatalf("balance %s: %v", ref, err)
	}
	return b
}
