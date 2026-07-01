// Package ledger là SỔ KÉP (double-entry) — nguồn chân lý duy nhất của mọi số dư.
//
// BẤT BIẾN #2: số dư = SUM(ledger_entries). KHÔNG có cột balance cache.
// Mỗi giao dịch là 1 Journal gồm N entry CÂN BẰNG: Σ credit = Σ debit.
// Phần "pure" (Journal + Validate) ở file này KHÔNG phụ thuộc DB nên test được tức thì.
package ledger

import (
	"errors"
	"fmt"

	"github.com/hkgroup/backend/internal/money"
)

// Direction: chiều ghi sổ. Quy ước số dư ví = Σ(credit) − Σ(debit).
//   - CREDIT làm tăng số dư ví (vd: cộng hoa hồng cho affiliate).
//   - DEBIT  làm giảm số dư ví (vd: trừ nguồn doanh thu khi phân bổ, khóa tiền khi rút).
type Direction string

const (
	Debit  Direction = "debit"
	Credit Direction = "credit"
)

// Kind là loại ví. Stakeholder kinds theo spec + system kinds nội bộ kế toán (revenue/cash).
type Kind string

const (
	// --- Stakeholder / customer wallets (theo enum nghiệp vụ) ---
	KindCommission      Kind = "commission"       // hoa hồng affiliate & hub
	KindPoint           Kind = "point"            // điểm Quỹ Đồng Chia (KHÔNG rút tiền)
	KindInvestor        Kind = "investor"         // ví nhà đầu tư (T9 — GATED)
	KindReferral        Kind = "referral"         // GATED — không dùng
	KindCompany         Kind = "company"          // HKGroup giữ phần còn lại + phần dư làm tròn
	KindCommunityPool   Kind = "community_pool"   // nguồn quỹ đồng chia (tích luỹ theo kỳ)
	KindShareholderPool Kind = "shareholder_pool" // pool nhà đầu tư (chỉ ghi nhận, T9 phân bổ)

	// --- System / clearing wallets (nội bộ kế toán, không hiển thị cho user) ---
	// Nguồn DEBIT khi phân bổ doanh thu đơn hàng; giữ sổ luôn cân bằng.
	KindRevenue Kind = "revenue" // doanh thu gộp đã ghi nhận, chờ phân bổ
	KindCash    Kind = "cash"    // tiền mặt/cổng thanh toán (ranh giới tiền vào/ra)
)

// WalletRef định danh 1 ví = (Kind, OwnerID). OwnerID rỗng = ví hệ thống (singleton).
type WalletRef struct {
	Kind    Kind
	OwnerID string // user/affiliate/hub/customer/investor id; rỗng nếu system
}

func (w WalletRef) IsSystem() bool { return w.OwnerID == "" }

func (w WalletRef) String() string {
	if w.IsSystem() {
		return fmt.Sprintf("%s:system", w.Kind)
	}
	return fmt.Sprintf("%s:%s", w.Kind, w.OwnerID)
}

// Entry là một dòng bút toán. Amount LUÔN > 0; chiều thể hiện qua Direction.
type Entry struct {
	Wallet    WalletRef
	Direction Direction
	Amount    money.VND
}

// Journal là một giao dịch nguyên tử gồm nhiều entry + tham chiếu nghiệp vụ để truy vết.
type Journal struct {
	// RefType/RefID: khóa nghiệp vụ để audit (vd "order"/orderID, "withdrawal"/wid).
	RefType string
	RefID   string
	Memo    string
	Entries []Entry
}

var (
	ErrNoEntries     = errors.New("ledger: journal rỗng, cần ít nhất 2 entry")
	ErrNonPositive   = errors.New("ledger: amount của entry phải > 0")
	ErrBadDirection  = errors.New("ledger: direction không hợp lệ")
	ErrUnbalanced    = errors.New("ledger: journal không cân bằng (Σ debit ≠ Σ credit)")
	ErrMissingRef    = errors.New("ledger: thiếu RefType/RefID để truy vết")
)

// Validate thực thi BẤT BIẾN #2: từ chối mọi journal lệch dù 1 đồng.
// Đây là cổng duy nhất trước khi ghi xuống DB — không journal nào được bỏ qua.
func (j Journal) Validate() error {
	if j.RefType == "" || j.RefID == "" {
		return ErrMissingRef
	}
	if len(j.Entries) < 2 {
		return ErrNoEntries
	}
	var debit, credit money.VND
	for _, e := range j.Entries {
		if !e.Amount.IsPositive() {
			return fmt.Errorf("%w: ví %s amount=%d", ErrNonPositive, e.Wallet, e.Amount.Int64())
		}
		switch e.Direction {
		case Debit:
			debit = debit.Add(e.Amount)
		case Credit:
			credit = credit.Add(e.Amount)
		default:
			return fmt.Errorf("%w: %q", ErrBadDirection, e.Direction)
		}
	}
	if debit != credit {
		return fmt.Errorf("%w: debit=%d credit=%d (lệch %d)",
			ErrUnbalanced, debit.Int64(), credit.Int64(), debit.Sub(credit).Int64())
	}
	return nil
}

// Total trả về tổng giá trị giao dịch (= Σ debit = Σ credit khi đã cân bằng).
func (j Journal) Total() money.VND {
	var credit money.VND
	for _, e := range j.Entries {
		if e.Direction == Credit {
			credit = credit.Add(e.Amount)
		}
	}
	return credit
}

// --- Builder tiện dụng để dựng journal cân bằng một cách an toàn ---

// NewJournal khởi tạo journal với khóa truy vết.
func NewJournal(refType, refID, memo string) *Journal {
	return &Journal{RefType: refType, RefID: refID, Memo: memo}
}

// Debit thêm 1 entry ghi nợ (giảm số dư ví). Bỏ qua nếu amount == 0 để journal gọn.
func (j *Journal) Debit(w WalletRef, amount money.VND) *Journal {
	if amount.IsZero() {
		return j
	}
	j.Entries = append(j.Entries, Entry{Wallet: w, Direction: Debit, Amount: amount})
	return j
}

// Credit thêm 1 entry ghi có (tăng số dư ví). Bỏ qua nếu amount == 0.
func (j *Journal) Credit(w WalletRef, amount money.VND) *Journal {
	if amount.IsZero() {
		return j
	}
	j.Entries = append(j.Entries, Entry{Wallet: w, Direction: Credit, Amount: amount})
	return j
}

// Reversed tạo bút toán ĐẢO (BẤT BIẾN #6): đảo chiều mọi entry, giữ nguyên amount.
// KHÔNG sửa/xóa entry cũ — refund/hủy luôn ghi journal mới đảo chiều.
func (j Journal) Reversed(refType, refID, memo string) Journal {
	rev := Journal{RefType: refType, RefID: refID, Memo: memo, Entries: make([]Entry, len(j.Entries))}
	for i, e := range j.Entries {
		d := Credit
		if e.Direction == Credit {
			d = Debit
		}
		rev.Entries[i] = Entry{Wallet: e.Wallet, Direction: d, Amount: e.Amount}
	}
	return rev
}
