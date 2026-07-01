// Package order chứa STATE MACHINE đơn hàng (T3) — phần pure, không DB.
//
// BẤT BIẾN #5: đổi trạng thái chỉ qua transition hợp lệ, trong 1 DB transaction (ở tầng store).
// COMPLETED là trigger DUY NHẤT cho Allocation Engine (phát NATS "order.completed").
package order

import "fmt"

type Status string

const (
	StatusCreated   Status = "CREATED"
	StatusPaid      Status = "PAID"
	StatusAssigned  Status = "ASSIGNED" // đã gán hub theo khu vực
	StatusShipping  Status = "SHIPPING"
	StatusCompleted Status = "COMPLETED" // -> kích hoạt phân bổ
	StatusCancelled Status = "CANCELLED"
	StatusRefunded  Status = "REFUNDED" // -> kích hoạt bút toán đảo nếu đã phân bổ
)

// transitions: tập chuyển hợp lệ. Mọi chuyển ngoài bảng này bị từ chối.
var transitions = map[Status]map[Status]bool{
	StatusCreated: {
		StatusPaid:      true,
		StatusCancelled: true,
	},
	StatusPaid: {
		StatusAssigned:  true,
		StatusCancelled: true, // hủy trước khi giao -> hoàn tiền tay/cổng, chưa phân bổ
		StatusRefunded:  true,
	},
	StatusAssigned: {
		StatusShipping:  true,
		StatusCancelled: true,
		StatusRefunded:  true,
	},
	StatusShipping: {
		StatusCompleted: true,
		StatusRefunded:  true,
	},
	StatusCompleted: {
		StatusRefunded: true, // refund sau khi đã phân bổ -> reversal
	},
	// CANCELLED / REFUNDED là trạng thái cuối.
	StatusCancelled: {},
	StatusRefunded:  {},
}

// IsValid kiểm tra status có nằm trong tập hợp lệ.
func (s Status) IsValid() bool {
	_, ok := transitions[s]
	return ok
}

// IsTerminal: trạng thái cuối, không chuyển đi đâu nữa.
func (s Status) IsTerminal() bool {
	next, ok := transitions[s]
	return ok && len(next) == 0
}

// CanTransition trả về true nếu from->to hợp lệ.
func CanTransition(from, to Status) bool {
	next, ok := transitions[from]
	if !ok {
		return false
	}
	return next[to]
}

// ErrInvalidTransition mô tả rõ chuyển trạng thái bị từ chối (mã lỗi rõ ràng — DoD).
type ErrInvalidTransition struct {
	From, To Status
}

func (e ErrInvalidTransition) Error() string {
	return fmt.Sprintf("order: chuyển trạng thái không hợp lệ %s -> %s", e.From, e.To)
}

// Transition trả về to nếu hợp lệ, ngược lại lỗi. Tầng store gọi hàm này TRONG transaction
// trước khi UPDATE — không bao giờ UPDATE status tùy tiện.
func Transition(from, to Status) (Status, error) {
	if !from.IsValid() {
		return "", fmt.Errorf("order: trạng thái nguồn không hợp lệ %q", from)
	}
	if !to.IsValid() {
		return "", fmt.Errorf("order: trạng thái đích không hợp lệ %q", to)
	}
	if !CanTransition(from, to) {
		return "", ErrInvalidTransition{From: from, To: to}
	}
	return to, nil
}

// TriggersAllocation: chỉ COMPLETED kích hoạt phân bổ.
func TriggersAllocation(to Status) bool { return to == StatusCompleted }

// TriggersReversal: REFUNDED sau khi đã phân bổ cần bút toán đảo.
func TriggersReversal(from, to Status) bool {
	return to == StatusRefunded && from == StatusCompleted
}
