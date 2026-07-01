// Package hub: nhượng quyền theo khu vực (T7). Level theo LŨY KẾ nhập hàng.
//
// Ngưỡng đã chốt: L1 < 50tr · L2 [50tr,100tr) · L3 >= 100tr (rate 15/20/25% cấu hình ở allocation).
// Ngưỡng để CẤU HÌNH ĐƯỢC (không hardcode rải rác) — truyền qua Thresholds.
package hub

import "github.com/hkgroup/backend/internal/money"

// Thresholds: cận dưới (lũy kế nhập) để đạt mỗi level.
type Thresholds struct {
	L2Min money.VND // mặc định 50.000.000đ
	L3Min money.VND // mặc định 100.000.000đ
}

func DefaultThresholds() Thresholds {
	return Thresholds{L2Min: 50_000_000, L3Min: 100_000_000}
}

// LevelFor trả level (1/2/3) theo lũy kế nhập hàng.
func (t Thresholds) LevelFor(cumulative money.VND) int {
	switch {
	case cumulative >= t.L3Min:
		return 3
	case cumulative >= t.L2Min:
		return 2
	default:
		return 1
	}
}
