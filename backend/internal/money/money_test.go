package money

import (
	"math"
	"testing"
)

func TestMulRateFloor_Basic(t *testing.T) {
	cases := []struct {
		amount VND
		bps    int64
		want   VND
	}{
		{1000, 1000, 100},   // 10% của 1000 = 100
		{999, 1000, 99},     // floor(99.9) = 99
		{1, 1000, 0},        // floor(0.1) = 0
		{12345, 500, 617},   // 5% của 12345 = 617.25 -> 617
		{100000, 1500, 15000}, // 15%
		{0, 9999, 0},        // 0 đồng -> 0
	}
	for _, c := range cases {
		if got := MulRateFloor(c.amount, c.bps); got != c.want {
			t.Errorf("MulRateFloor(%d, %d) = %d, want %d", c.amount, c.bps, got, c.want)
		}
	}
}

// MulDivFloor không được tràn dù số tiền cực lớn (gần int64 max).
func TestMulDivFloor_NoOverflow(t *testing.T) {
	big := VND(9_000_000_000_000_000) // 9 triệu tỷ đồng
	// floor(big * 1500 / 10000) = big * 0.15
	got := MulDivFloor(big, 1500, 10000)
	want := VND(1_350_000_000_000_000)
	if got != want {
		t.Fatalf("MulDivFloor overflow case = %d, want %d", got, want)
	}
}

// PROPERTY: floor(x*bps/10000) + phần dư == x khi cộng lại các phần. Kiểm tra tính floor.
func TestMulRateFloor_IsFloorNotRound(t *testing.T) {
	// 5% của 12345 = 617.25; floor phải là 617, KHÔNG phải 617.x làm tròn lên.
	if got := MulRateFloor(12345, 500); got != 617 {
		t.Fatalf("floor sai: got %d, want 617", got)
	}
	// 7% của 1 = 0.07 -> 0
	if got := MulRateFloor(1, 700); got != 0 {
		t.Fatalf("floor sai cho số nhỏ: got %d, want 0", got)
	}
}

func TestMulDivFloor_PanicOnZeroDen(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("MulDivFloor(_, _, 0) phải panic")
		}
	}()
	MulDivFloor(100, 1, 0)
}

func TestVND_String(t *testing.T) {
	cases := map[VND]string{
		0:        "0₫",
		100:      "100₫",
		1000:     "1.000₫",
		1234567:  "1.234.567₫",
		-50000:   "-50.000₫",
	}
	for in, want := range cases {
		if got := in.String(); got != want {
			t.Errorf("VND(%d).String() = %q, want %q", int64(in), got, want)
		}
	}
}

func TestVND_Helpers(t *testing.T) {
	if !VND(-1).IsNegative() {
		t.Error("-1 phải IsNegative")
	}
	if !VND(0).IsZero() {
		t.Error("0 phải IsZero")
	}
	if VND(5).Add(3) != 8 || VND(5).Sub(3) != 2 || VND(5).Neg() != -5 {
		t.Error("Add/Sub/Neg sai")
	}
	if int64(VND(math.MaxInt64)) != math.MaxInt64 {
		t.Error("Int64 conversion sai")
	}
}
