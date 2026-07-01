package order

import (
	"errors"
	"testing"
)

func TestTransition_ValidPaths(t *testing.T) {
	valid := [][2]Status{
		{StatusCreated, StatusPaid},
		{StatusPaid, StatusAssigned},
		{StatusAssigned, StatusShipping},
		{StatusShipping, StatusCompleted},
		{StatusCompleted, StatusRefunded},
		{StatusCreated, StatusCancelled},
		{StatusPaid, StatusRefunded},
	}
	for _, p := range valid {
		if _, err := Transition(p[0], p[1]); err != nil {
			t.Errorf("%s->%s phải hợp lệ, got %v", p[0], p[1], err)
		}
	}
}

func TestTransition_InvalidPaths(t *testing.T) {
	invalid := [][2]Status{
		{StatusCreated, StatusCompleted}, // nhảy cóc
		{StatusCreated, StatusShipping},
		{StatusCompleted, StatusPaid},   // lùi
		{StatusCancelled, StatusPaid},   // từ terminal
		{StatusRefunded, StatusCreated}, // từ terminal
		{StatusPaid, StatusCompleted},   // bỏ qua assigned/shipping
	}
	for _, p := range invalid {
		_, err := Transition(p[0], p[1])
		if err == nil {
			t.Errorf("%s->%s phải bị từ chối", p[0], p[1])
		}
		var e ErrInvalidTransition
		if !errors.As(err, &e) && p[0].IsValid() && p[1].IsValid() {
			t.Errorf("%s->%s phải trả ErrInvalidTransition, got %v", p[0], p[1], err)
		}
	}
}

func TestStatus_Terminal(t *testing.T) {
	if !StatusCancelled.IsTerminal() || !StatusRefunded.IsTerminal() {
		t.Error("CANCELLED/REFUNDED phải là terminal")
	}
	if StatusCompleted.IsTerminal() {
		t.Error("COMPLETED chưa phải terminal (còn -> REFUNDED)")
	}
}

func TestTriggers(t *testing.T) {
	if !TriggersAllocation(StatusCompleted) {
		t.Error("COMPLETED phải kích hoạt allocation")
	}
	if TriggersAllocation(StatusPaid) {
		t.Error("PAID không được kích hoạt allocation")
	}
	if !TriggersReversal(StatusCompleted, StatusRefunded) {
		t.Error("COMPLETED->REFUNDED phải kích hoạt reversal")
	}
	if TriggersReversal(StatusPaid, StatusRefunded) {
		t.Error("PAID->REFUNDED chưa phân bổ nên KHÔNG reversal")
	}
}

func TestStatus_InvalidName(t *testing.T) {
	if Status("BOGUS").IsValid() {
		t.Error("status lạ phải invalid")
	}
	if _, err := Transition("BOGUS", StatusPaid); err == nil {
		t.Error("nguồn lạ phải lỗi")
	}
}
