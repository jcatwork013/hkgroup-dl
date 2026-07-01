// Format tiền VND. Tiền từ backend là số nguyên ĐỒNG (BIGINT) -> hiển thị có dấu phân cách.
const vnd = new Intl.NumberFormat("vi-VN");

export function formatVND(amount: number | bigint): string {
  return `${vnd.format(amount)}₫`;
}

export function formatNumber(n: number | bigint): string {
  return vnd.format(n);
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}
