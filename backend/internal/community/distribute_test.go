package community

import (
	"math/rand"
	"testing"

	"github.com/hkgroup/backend/internal/money"
)

// INVARIANT: Σ điểm <= pool; leftover = pool - Σ >= 0.
func TestDistribute_NeverExceedsPool(t *testing.T) {
	rng := rand.New(rand.NewSource(7))
	for i := 0; i < 20000; i++ {
		pool := money.VND(rng.Int63n(100_000_000))
		n := rng.Intn(20)
		els := make([]Eligible, n)
		for j := range els {
			els[j] = Eligible{CustomerID: string(rune('a' + j)), Sales: money.VND(rng.Int63n(50_000_000))}
		}
		res := Distribute(pool, els)
		if res.Distributed > pool {
			t.Fatalf("Σ điểm %d vượt pool %d", res.Distributed, pool)
		}
		if res.Leftover.IsNegative() {
			t.Fatalf("leftover âm: %d", res.Leftover)
		}
		if res.Distributed.Add(res.Leftover) != pool {
			t.Fatalf("Distributed+Leftover != pool: %d+%d != %d", res.Distributed, res.Leftover, pool)
		}
	}
}

func TestDistribute_Proportional(t *testing.T) {
	// pool 1.000.000; 2 khách doanh số 600k và 400k -> 600k & 400k điểm.
	res := Distribute(1_000_000, []Eligible{
		{CustomerID: "a", Sales: 600_000},
		{CustomerID: "b", Sales: 400_000},
	})
	got := map[string]money.VND{}
	for _, d := range res.Distributions {
		got[d.CustomerID] = d.Points
	}
	if got["a"] != 600_000 || got["b"] != 400_000 {
		t.Fatalf("phân bổ sai: %+v", got)
	}
	if res.Leftover != 0 {
		t.Fatalf("leftover phải 0, got %d", res.Leftover)
	}
}

func TestDistribute_RoundingLeftover(t *testing.T) {
	// pool 10; 3 khách bằng nhau -> mỗi người floor(10/3)=3, Σ=9, leftover=1.
	res := Distribute(10, []Eligible{
		{CustomerID: "a", Sales: 100},
		{CustomerID: "b", Sales: 100},
		{CustomerID: "c", Sales: 100},
	})
	if res.Distributed != 9 || res.Leftover != 1 {
		t.Fatalf("Distributed=%d Leftover=%d, want 9/1", res.Distributed, res.Leftover)
	}
}

func TestDistribute_EmptyAndZero(t *testing.T) {
	if r := Distribute(0, []Eligible{{CustomerID: "a", Sales: 100}}); r.Distributed != 0 || r.Leftover != 0 {
		t.Fatalf("pool 0 phải không phát điểm: %+v", r)
	}
	if r := Distribute(1000, nil); r.Distributed != 0 || r.Leftover != 1000 {
		t.Fatalf("không eligible -> carry toàn bộ: %+v", r)
	}
	if r := Distribute(1000, []Eligible{{CustomerID: "a", Sales: 0}}); r.Distributed != 0 || r.Leftover != 1000 {
		t.Fatalf("sales 0 -> không phát: %+v", r)
	}
}
