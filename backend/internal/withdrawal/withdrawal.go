// Package withdrawal: rút ví hoa hồng (T6) — state machine + validate phía SERVER.
//
// BẤT BIẾN #7: validate cửa sổ rút [15,30] và đủ số dư ở SERVER, KHÔNG tin client.
// Khi REQUESTED: khóa số dư (ghi entry "hold" ở tầng ledger). Idempotent theo withdrawal_id.
package withdrawal

import (
	"fmt"
	"time"

	"github.com/hkgroup/backend/internal/money"
)

type Status string

const (
	StatusRequested Status = "REQUESTED" // đã khóa số dư
	StatusApproved  Status = "APPROVED"
	StatusPaid      Status = "PAID"
	StatusRejected  Status = "REJECTED" // nhả khóa số dư
)

var transitions = map[Status]map[Status]bool{
	StatusRequested: {StatusApproved: true, StatusRejected: true},
	StatusApproved:  {StatusPaid: true, StatusRejected: true},
	StatusPaid:      {},
	StatusRejected:  {},
}

func (s Status) IsValid() bool   { _, ok := transitions[s]; return ok }
func (s Status) IsTerminal() bool { n, ok := transitions[s]; return ok && len(n) == 0 }

func CanTransition(from, to Status) bool {
	n, ok := transitions[from]
	return ok && n[to]
}

type ErrInvalidTransition struct{ From, To Status }

func (e ErrInvalidTransition) Error() string {
	return fmt.Sprintf("withdrawal: chuyển trạng thái không hợp lệ %s -> %s", e.From, e.To)
}

func Transition(from, to Status) (Status, error) {
	if !from.IsValid() || !to.IsValid() {
		return "", fmt.Errorf("withdrawal: trạng thái không hợp lệ %s/%s", from, to)
	}
	if !CanTransition(from, to) {
		return "", ErrInvalidTransition{from, to}
	}
	return to, nil
}

// Window là cửa sổ rút theo NGÀY trong tháng (mặc định [15,30]). Cấu hình qua env.
type Window struct {
	StartDay int
	EndDay   int
}

func DefaultWindow() Window { return Window{StartDay: 15, EndDay: 30} }

// AllowsDay kiểm tra ngày trong tháng có nằm trong cửa sổ không (inclusive 2 đầu).
func (w Window) AllowsDay(day int) bool {
	return day >= w.StartDay && day <= w.EndDay
}

// AllowsAt kiểm tra theo thời điểm (dùng ngày trong tháng của t).
func (w Window) AllowsAt(t time.Time) bool {
	return w.AllowsDay(t.Day())
}

// Lỗi nghiệp vụ có mã rõ ràng (DoD).
type Error struct {
	Code string
	Msg  string
}

func (e Error) Error() string { return fmt.Sprintf("[%s] %s", e.Code, e.Msg) }

var (
	ErrOutsideWindow    = Error{Code: "WITHDRAW_OUTSIDE_WINDOW", Msg: "ngoài cửa sổ rút trong tháng"}
	ErrInsufficient     = Error{Code: "WITHDRAW_INSUFFICIENT", Msg: "số dư khả dụng không đủ"}
	ErrNonPositiveAmt   = Error{Code: "WITHDRAW_NONPOSITIVE", Msg: "số tiền rút phải > 0"}
)

// ValidateRequest kiểm tra TOÀN BỘ điều kiện tạo yêu cầu rút ở SERVER.
//   - amount > 0
//   - thời điểm nằm trong cửa sổ [start,end]
//   - available = số dư - đang khóa, phải >= amount (không cho rút âm)
func ValidateRequest(amount, available money.VND, w Window, at time.Time) error {
	if !amount.IsPositive() {
		return ErrNonPositiveAmt
	}
	if !w.AllowsAt(at) {
		return ErrOutsideWindow
	}
	if amount > available {
		return ErrInsufficient
	}
	return nil
}
