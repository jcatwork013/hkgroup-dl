package hub

import (
	"testing"

	"github.com/hkgroup/backend/internal/money"
)

// Biên ngưỡng đã chốt: 49.999.999->L1, 50tr->L2, 99.999.999->L2, 100tr->L3.
func TestLevelFor_Boundaries(t *testing.T) {
	th := DefaultThresholds()
	cases := []struct {
		cum  int64
		want int
	}{
		{0, 1},
		{49_999_999, 1},
		{50_000_000, 2},
		{99_999_999, 2},
		{100_000_000, 3},
		{500_000_000, 3},
	}
	for _, c := range cases {
		if got := th.LevelFor(money.VND(c.cum)); got != c.want {
			t.Errorf("LevelFor(%d) = %d, want %d", c.cum, got, c.want)
		}
	}
}
