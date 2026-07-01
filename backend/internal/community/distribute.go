// Package community: Quỹ Đồng Chia (T8) — phân bổ ĐIỂM cuối kỳ.
//
// BẤT BIẾN #4: floor; Σ điểm phát ra <= pool (KHÔNG vượt nguồn quỹ).
// LƯU Ý SPEC: "doanh số" tính theo KỲ hay LŨY KẾ chưa chốt -> tầng job sẽ hỏi;
// hàm pure này nhận sẵn Sales theo cơ sở đã chọn nên không phụ thuộc quyết định đó.
//
// Điểm chỉ đổi sản phẩm / thanh toán đơn — KHÔNG rút tiền (enforced ở tầng ví: kind=point).
package community

import "github.com/hkgroup/backend/internal/money"

// Eligible là 1 khách đủ điều kiện nhận điểm trong kỳ.
type Eligible struct {
	CustomerID string
	Sales      money.VND // doanh số dùng làm trọng số (theo cơ sở đã chọn)
}

// Distribution là kết quả điểm cho 1 khách.
type Distribution struct {
	CustomerID string
	Points     money.VND
}

// Result gói kết quả + phần dư (leftover) do làm tròn — leftover giữ lại trong pool kỳ sau.
type Result struct {
	Distributions []Distribution
	Distributed   money.VND // Σ điểm đã phát
	Leftover      money.VND // pool - Distributed (>= 0)
}

// Distribute chia pool theo tỷ lệ Sales cho các khách đủ điều kiện.
//
//	points_c = floor(pool * sales_c / total_sales_eligible)
//
// EligibleMin được lọc TRƯỚC khi gọi (tầng job), nhưng hàm vẫn bỏ qua sales<=0 cho an toàn.
// Bất biến: Distributed <= pool; Leftover = pool - Distributed >= 0.
func Distribute(pool money.VND, eligibles []Eligible) Result {
	res := Result{Distributions: make([]Distribution, 0, len(eligibles))}
	if pool.IsZero() || pool.IsNegative() {
		res.Leftover = pool
		return res
	}

	var totalSales money.VND
	for _, e := range eligibles {
		if e.Sales.IsPositive() {
			totalSales = totalSales.Add(e.Sales)
		}
	}
	if totalSales.IsZero() {
		// Không ai có doanh số -> không phát điểm, toàn bộ pool carry sang kỳ sau.
		res.Leftover = pool
		return res
	}

	for _, e := range eligibles {
		if !e.Sales.IsPositive() {
			continue
		}
		pts := money.MulDivFloor(pool, e.Sales.Int64(), totalSales.Int64())
		if pts.IsZero() {
			continue
		}
		res.Distributions = append(res.Distributions, Distribution{CustomerID: e.CustomerID, Points: pts})
		res.Distributed = res.Distributed.Add(pts)
	}
	res.Leftover = pool.Sub(res.Distributed)
	return res
}
