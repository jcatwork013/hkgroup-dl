// Package allocation chứa TOÁN phân bổ doanh thu đơn hàng (T4) và Engine ghi sổ.
//
// File này là phần PURE (không DB): hàm Allocate đảm bảo BẤT BIẾN #4:
//   - làm tròn FLOOR cho từng phần,
//   - ví COMPANY hấp thụ toàn bộ phần dư,
//   - Σ phân bổ == gốc TUYỆT ĐỐI (lệch 1 đồng = bug).
package allocation

import (
	"errors"
	"fmt"

	"github.com/hkgroup/backend/internal/money"
)

// Params là các tỷ lệ (basis points) áp cho 1 đơn. HubBPS đã được resolve theo level hub.
// Nếu đơn không có affiliate -> truyền HasAffiliate=false (aff=0). Không có hub -> HubBPS=0.
type Params struct {
	AffiliateBPS   int64 // mặc định 1000 = 10%
	HubBPS         int64 // 1500/2000/2500 theo level; 0 nếu không gán hub
	CommunityBPS   int64 // 500 = 5% (Quỹ Đồng Chia -> điểm)
	ShareholderBPS int64 // 1500 = 15% (chỉ ghi vào pool, T9 mới phân bổ investor)
}

// Split là kết quả phân bổ. Company = phần còn lại (đã gồm phần dư làm tròn).
type Split struct {
	Affiliate   money.VND
	Hub         money.VND
	Community   money.VND
	Shareholder money.VND
	Company     money.VND
}

// Sum tổng 5 phần. Bất biến: Sum() == total gốc.
func (s Split) Sum() money.VND {
	return s.Affiliate.Add(s.Hub).Add(s.Community).Add(s.Shareholder).Add(s.Company)
}

var (
	ErrNegativeTotal = errors.New("allocation: total không được âm")
	ErrRateOverflow  = errors.New("allocation: tổng tỷ lệ vượt 100% (10000 bps)")
)

// Allocate phân bổ total thành 5 phần theo Params.
// hasAffiliate=false -> Affiliate=0 (đơn không có người giới thiệu).
// Đảm bảo: kết quả.Sum() == total trong MỌI nhánh (kể cả khi không có affiliate/hub).
func Allocate(total money.VND, hasAffiliate bool, p Params) (Split, error) {
	if total.IsNegative() {
		return Split{}, ErrNegativeTotal
	}
	// Tỷ lệ stakeholder tối đa (gồm cả affiliate dù có hay không) phải <= 100%
	// để company không bao giờ âm.
	if p.AffiliateBPS+p.HubBPS+p.CommunityBPS+p.ShareholderBPS > money.BasisPointDenominator {
		return Split{}, fmt.Errorf("%w: aff=%d hub=%d comm=%d share=%d",
			ErrRateOverflow, p.AffiliateBPS, p.HubBPS, p.CommunityBPS, p.ShareholderBPS)
	}

	var aff money.VND
	if hasAffiliate {
		aff = money.MulRateFloor(total, p.AffiliateBPS)
	}
	hub := money.MulRateFloor(total, p.HubBPS)
	comm := money.MulRateFloor(total, p.CommunityBPS)
	share := money.MulRateFloor(total, p.ShareholderBPS)

	// COMPANY hấp thụ phần dư: company = total - (các phần đã floor).
	// Vì mỗi phần đã floor xuống, tổng 4 phần <= total -> company >= 0.
	company := total.Sub(aff).Sub(hub).Sub(comm).Sub(share)

	return Split{
		Affiliate:   aff,
		Hub:         hub,
		Community:   comm,
		Shareholder: share,
		Company:     company,
	}, nil
}
