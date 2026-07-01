// Package money là kiểu tiền tệ duy nhất được phép dùng trên đường đi của tiền.
//
// BẤT BIẾN #1: Tiền lưu BIGINT đơn vị ĐỒNG (VND). TUYỆT ĐỐI không float/decimal.
// Mọi phép chia/nhân tỷ lệ làm tròn bằng FLOOR (BẤT BIẾN #4) và dùng math/big nội bộ
// để KHÔNG bao giờ tràn int64 dù số tiền cực lớn — vẫn là số nguyên chính xác tuyệt đối.
package money

import (
	"math/big"
	"strconv"
)

// VND là số tiền theo đơn vị đồng. Không âm hay dương đều hợp lệ (entry đảo dùng số âm).
type VND int64

// Zero tiện cho so sánh và khởi tạo.
const Zero VND = 0

// BasisPointDenominator: 10000 bps = 100%. 1% = 100 bps.
const BasisPointDenominator int64 = 10000

// Int64 trả về giá trị thô để ghi xuống cột BIGINT.
func (v VND) Int64() int64 { return int64(v) }

// Add / Sub là cộng trừ tường minh để code đọc rõ ý đồ.
func (v VND) Add(o VND) VND { return v + o }
func (v VND) Sub(o VND) VND { return v - o }
func (v VND) Neg() VND      { return -v }

func (v VND) IsZero() bool     { return v == 0 }
func (v VND) IsNegative() bool { return v < 0 }
func (v VND) IsPositive() bool { return v > 0 }

// MulDivFloor = floor(v * num / den), tính bằng big.Int để tránh tràn và tránh float.
// Dùng cho phân bổ theo tỷ lệ (vd floor(pool * sales_c / total_sales)).
// Panic nếu den <= 0 vì đó là lỗi lập trình, không phải lỗi dữ liệu.
func MulDivFloor(v VND, num, den int64) VND {
	if den <= 0 {
		panic("money.MulDivFloor: mẫu số phải > 0")
	}
	// big.Int.Quo cắt về 0 (truncate). Với v,num,den >= 0 thì truncate == floor.
	// Tiền gốc và num/den trong hệ thống luôn không âm nên floor là đúng.
	bv := big.NewInt(int64(v))
	bv.Mul(bv, big.NewInt(num))
	bv.Quo(bv, big.NewInt(den))
	if !bv.IsInt64() {
		// Số tiền vượt int64 là bất thường nghiêm trọng — fail nhanh thay vì âm thầm sai.
		panic("money.MulDivFloor: kết quả vượt int64")
	}
	return VND(bv.Int64())
}

// MulRateFloor = floor(v * bps / 10000). Tiện ích cho tỷ lệ phần trăm theo basis points.
func MulRateFloor(v VND, bps int64) VND {
	return MulDivFloor(v, bps, BasisPointDenominator)
}

// String format có dấu phân cách hàng nghìn + "₫", dùng cho log/debug (FE tự format hiển thị).
func (v VND) String() string {
	n := int64(v)
	neg := n < 0
	if neg {
		n = -n
	}
	s := strconv.FormatInt(n, 10)
	// chèn dấu chấm mỗi 3 chữ số từ phải sang
	out := make([]byte, 0, len(s)+len(s)/3+2)
	for i, c := range []byte(s) {
		if i > 0 && (len(s)-i)%3 == 0 {
			out = append(out, '.')
		}
		out = append(out, c)
	}
	res := string(out) + "₫"
	if neg {
		return "-" + res
	}
	return res
}
