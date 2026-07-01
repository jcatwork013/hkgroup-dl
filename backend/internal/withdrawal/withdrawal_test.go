package withdrawal

import (
	"errors"
	"testing"
	"time"

	"github.com/hkgroup/backend/internal/money"
)

func TestTransition_Valid(t *testing.T) {
	valid := [][2]Status{
		{StatusRequested, StatusApproved},
		{StatusApproved, StatusPaid},
		{StatusRequested, StatusRejected},
		{StatusApproved, StatusRejected},
	}
	for _, p := range valid {
		if _, err := Transition(p[0], p[1]); err != nil {
			t.Errorf("%s->%s phải hợp lệ: %v", p[0], p[1], err)
		}
	}
}

func TestTransition_Invalid(t *testing.T) {
	invalid := [][2]Status{
		{StatusRequested, StatusPaid}, // bỏ qua approved
		{StatusPaid, StatusApproved},
		{StatusRejected, StatusApproved},
		{StatusPaid, StatusRejected},
	}
	for _, p := range invalid {
		if _, err := Transition(p[0], p[1]); err == nil {
			t.Errorf("%s->%s phải bị từ chối", p[0], p[1])
		}
	}
}

// BẤT BIẾN #7: biên ngày 14/15/30/31.
func TestWindow_Boundaries(t *testing.T) {
	w := DefaultWindow() // [15,30]
	cases := map[int]bool{14: false, 15: true, 20: true, 30: true, 31: false}
	for day, want := range cases {
		if got := w.AllowsDay(day); got != want {
			t.Errorf("ngày %d: AllowsDay=%v, want %v", day, got, want)
		}
	}
}

func TestValidateRequest(t *testing.T) {
	w := DefaultWindow()
	inWindow := time.Date(2026, 6, 20, 10, 0, 0, 0, time.UTC)  // ngày 20 -> trong
	outWindow := time.Date(2026, 6, 5, 10, 0, 0, 0, time.UTC) // ngày 5 -> ngoài

	// hợp lệ
	if err := ValidateRequest(100_000, 500_000, w, inWindow); err != nil {
		t.Fatalf("phải hợp lệ: %v", err)
	}
	// ngoài cửa sổ
	if err := ValidateRequest(100_000, 500_000, w, outWindow); !errors.Is(err, ErrOutsideWindow) {
		t.Fatalf("ngoài cửa sổ phải lỗi, got %v", err)
	}
	// không đủ số dư (không cho rút âm)
	if err := ValidateRequest(600_000, 500_000, w, inWindow); !errors.Is(err, ErrInsufficient) {
		t.Fatalf("thiếu số dư phải lỗi, got %v", err)
	}
	// số tiền <= 0
	if err := ValidateRequest(0, 500_000, w, inWindow); !errors.Is(err, ErrNonPositiveAmt) {
		t.Fatalf("amount 0 phải lỗi, got %v", err)
	}
	if err := ValidateRequest(money.VND(-1), 500_000, w, inWindow); !errors.Is(err, ErrNonPositiveAmt) {
		t.Fatalf("amount âm phải lỗi, got %v", err)
	}
}

// rút đúng bằng available -> hợp lệ; rút available+1 -> lỗi.
func TestValidateRequest_ExactBalance(t *testing.T) {
	w := DefaultWindow()
	at := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	if err := ValidateRequest(500_000, 500_000, w, at); err != nil {
		t.Fatalf("rút đúng bằng available phải OK: %v", err)
	}
	if err := ValidateRequest(500_001, 500_000, w, at); !errors.Is(err, ErrInsufficient) {
		t.Fatalf("rút quá 1 đồng phải lỗi: %v", err)
	}
}
