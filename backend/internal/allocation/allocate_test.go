package allocation

import (
	"errors"
	"math/rand"
	"testing"

	"github.com/hkgroup/backend/internal/money"
)

// Tỷ lệ mặc định theo spec: aff 10%, comm 5%, share 15%, hub tuỳ level.
func defaultParams(hubBps int64) Params {
	return Params{AffiliateBPS: 1000, HubBPS: hubBps, CommunityBPS: 500, ShareholderBPS: 1500}
}

// INVARIANT cốt lõi T4: aff+hub+comm+share+company == total — MỌI nhánh.
func TestAllocate_SumEqualsTotal_Invariant(t *testing.T) {
	hubLevels := []int64{0, 1500, 2000, 2500}
	for _, hub := range hubLevels {
		for _, hasAff := range []bool{true, false} {
			for total := money.VND(0); total <= 5000; total++ {
				s, err := Allocate(total, hasAff, defaultParams(hub))
				if err != nil {
					t.Fatalf("Allocate lỗi: %v", err)
				}
				if s.Sum() != total {
					t.Fatalf("INVARIANT VỠ: total=%d hub=%d hasAff=%v -> Sum=%d (lệch %d)",
						total, hub, hasAff, s.Sum(), s.Sum().Sub(total))
				}
				if s.Company.IsNegative() {
					t.Fatalf("company âm: %+v (total=%d)", s, total)
				}
				if !hasAff && !s.Affiliate.IsZero() {
					t.Fatalf("không có affiliate nhưng aff=%d", s.Affiliate)
				}
			}
		}
	}
}

// PROPERTY test: hàng nghìn total ngẫu nhiên lớn, invariant luôn giữ.
func TestAllocate_Property_RandomLargeTotals(t *testing.T) {
	rng := rand.New(rand.NewSource(42)) // seed cố định -> tái lập được
	for i := 0; i < 100000; i++ {
		total := money.VND(rng.Int63n(1_000_000_000_000)) // tới ~1000 tỷ
		hub := []int64{0, 1500, 2000, 2500}[rng.Intn(4)]
		hasAff := rng.Intn(2) == 0
		s, err := Allocate(total, hasAff, defaultParams(hub))
		if err != nil {
			t.Fatalf("Allocate lỗi: %v", err)
		}
		if s.Sum() != total {
			t.Fatalf("INVARIANT VỠ ngẫu nhiên: total=%d -> Sum=%d", total, s.Sum())
		}
	}
}

// Số cụ thể: 1.000.000đ, hub L1 15%, có affiliate.
func TestAllocate_ConcreteNumbers(t *testing.T) {
	s, err := Allocate(1_000_000, true, defaultParams(1500))
	if err != nil {
		t.Fatal(err)
	}
	// aff 10% = 100k, hub 15% = 150k, comm 5% = 50k, share 15% = 150k, company = 550k
	want := Split{Affiliate: 100_000, Hub: 150_000, Community: 50_000, Shareholder: 150_000, Company: 550_000}
	if s != want {
		t.Fatalf("Split = %+v, want %+v", s, want)
	}
}

// Phần dư làm tròn dồn về company: total = 7 đồng, mọi tỷ lệ floor về 0 -> company = 7.
func TestAllocate_RoundingRemainderToCompany(t *testing.T) {
	s, err := Allocate(7, true, defaultParams(1500))
	if err != nil {
		t.Fatal(err)
	}
	// 10% của 7 = 0.7 -> 0; tương tự các phần khác -> tất cả 0, company = 7.
	if s.Affiliate != 0 || s.Hub != 1 /*15% của 7=1.05->1*/ {
		// hub 15% của 7 = 1.05 -> floor 1
	}
	if s.Sum() != 7 {
		t.Fatalf("Sum=%d, want 7", s.Sum())
	}
	// company nhận toàn bộ phần dư.
	if s.Company != s.Sum().Sub(s.Affiliate).Sub(s.Hub).Sub(s.Community).Sub(s.Shareholder) {
		t.Fatalf("company không bằng phần dư")
	}
}

func TestAllocate_NegativeTotal_Error(t *testing.T) {
	if _, err := Allocate(-1, true, defaultParams(1500)); !errors.Is(err, ErrNegativeTotal) {
		t.Fatalf("total âm phải lỗi, got %v", err)
	}
}

func TestAllocate_RateOverflow_Error(t *testing.T) {
	bad := Params{AffiliateBPS: 5000, HubBPS: 4000, CommunityBPS: 2000, ShareholderBPS: 0} // 110%
	if _, err := Allocate(1000, true, bad); !errors.Is(err, ErrRateOverflow) {
		t.Fatalf("tỷ lệ >100%% phải lỗi, got %v", err)
	}
}
