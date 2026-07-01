package ledger

import (
	"errors"
	"testing"

	"github.com/hkgroup/backend/internal/money"
)

func sysCompany() WalletRef  { return WalletRef{Kind: KindCompany} }
func sysRevenue() WalletRef  { return WalletRef{Kind: KindRevenue} }
func affWallet(id string) WalletRef { return WalletRef{Kind: KindCommission, OwnerID: id} }

// T0 DoD: journal cân bằng -> ok.
func TestJournal_Balanced_OK(t *testing.T) {
	j := NewJournal("order", "ord-1", "phân bổ").
		Debit(sysRevenue(), 1000).
		Credit(affWallet("aff-1"), 100).
		Credit(sysCompany(), 900)
	if err := j.Validate(); err != nil {
		t.Fatalf("journal cân bằng phải hợp lệ, got: %v", err)
	}
	if j.Total() != 1000 {
		t.Fatalf("Total = %d, want 1000", j.Total())
	}
}

// T0 DoD: lệch 1 đồng -> reject.
func TestJournal_OffByOne_Rejected(t *testing.T) {
	j := NewJournal("order", "ord-2", "lệch").
		Debit(sysRevenue(), 1000).
		Credit(affWallet("aff-1"), 100).
		Credit(sysCompany(), 899) // thiếu 1 đồng
	err := j.Validate()
	if !errors.Is(err, ErrUnbalanced) {
		t.Fatalf("phải reject vì lệch 1 đồng, got: %v", err)
	}
}

func TestJournal_NonPositiveAmount_Rejected(t *testing.T) {
	j := &Journal{RefType: "x", RefID: "1", Entries: []Entry{
		{Wallet: sysRevenue(), Direction: Debit, Amount: money.VND(0)},
		{Wallet: sysCompany(), Direction: Credit, Amount: money.VND(0)},
	}}
	// amount 0 bị builder bỏ qua, nhưng nếu nhét tay thì Validate phải bắt.
	if err := j.Validate(); !errors.Is(err, ErrNonPositive) {
		// Lưu ý: ở đây 2 entry amount 0 -> ErrNonPositive ở entry đầu tiên.
		t.Fatalf("amount 0 phải bị reject, got: %v", err)
	}
}

func TestJournal_TooFewEntries_Rejected(t *testing.T) {
	j := NewJournal("order", "ord-3", "thiếu entry").Credit(sysCompany(), 100)
	if err := j.Validate(); !errors.Is(err, ErrNoEntries) {
		t.Fatalf("journal 1 entry phải bị reject, got: %v", err)
	}
}

func TestJournal_MissingRef_Rejected(t *testing.T) {
	j := &Journal{Entries: []Entry{
		{Wallet: sysRevenue(), Direction: Debit, Amount: 100},
		{Wallet: sysCompany(), Direction: Credit, Amount: 100},
	}}
	if err := j.Validate(); !errors.Is(err, ErrMissingRef) {
		t.Fatalf("thiếu ref phải bị reject, got: %v", err)
	}
}

func TestJournal_BadDirection_Rejected(t *testing.T) {
	j := &Journal{RefType: "x", RefID: "1", Entries: []Entry{
		{Wallet: sysRevenue(), Direction: "sideways", Amount: 100},
		{Wallet: sysCompany(), Direction: Credit, Amount: 100},
	}}
	if err := j.Validate(); !errors.Is(err, ErrBadDirection) {
		t.Fatalf("direction sai phải bị reject, got: %v", err)
	}
}

// BẤT BIẾN #6: bút toán đảo phải cân bằng và đảo đúng chiều.
func TestJournal_Reversed(t *testing.T) {
	orig := NewJournal("order", "ord-9", "gốc").
		Debit(sysRevenue(), 1000).
		Credit(affWallet("aff-1"), 100).
		Credit(sysCompany(), 900)
	rev := orig.Reversed("order_refund", "ord-9", "đảo")
	if err := rev.Validate(); err != nil {
		t.Fatalf("journal đảo phải cân bằng, got: %v", err)
	}
	// entry đầu của gốc là Debit revenue -> đảo phải là Credit revenue.
	if rev.Entries[0].Direction != Credit {
		t.Fatalf("Reversed không đảo chiều: %v", rev.Entries[0].Direction)
	}
	// Tổng không đổi.
	if rev.Total() != orig.Total() {
		t.Fatalf("Reversed đổi tổng: %d vs %d", rev.Total(), orig.Total())
	}
}
