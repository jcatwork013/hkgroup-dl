import type { CartItem } from "./cart";
import type { CheckoutResult } from "./checkout";
import { formatVND } from "./format";

export type InvoiceCustomer = { customer_name: string; customer_phone: string; address: string };

// In hoá đơn: mở cửa sổ mới với HTML hoá đơn rồi gọi print (không phụ thuộc CSS toàn cục).
export function printInvoice(order: CheckoutResult, items: CartItem[], customer: InvoiceCustomer): void {
  const rows = items
    .map(
      (i) => `<tr>
        <td>${escapeHtml(i.name)}</td>
        <td style="text-align:center">${i.qty}</td>
        <td style="text-align:right">${formatVND(i.price_vnd)}</td>
        <td style="text-align:right">${formatVND(i.price_vnd * i.qty)}</td>
      </tr>`
    )
    .join("");
  const b = order.bank;
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Hoá đơn ${order.code}</title>
  <style>
    *{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1d1a}
    body{max-width:720px;margin:24px auto;padding:0 20px}
    h1{font-size:22px;margin:0}
    .muted{color:#666;font-size:13px}
    .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #143021;padding-bottom:12px}
    table{width:100%;border-collapse:collapse;margin-top:18px}
    th,td{padding:8px 6px;border-bottom:1px solid #eee;font-size:14px}
    th{text-align:left;color:#666;font-weight:600}
    .tot{margin-top:14px;text-align:right;font-size:16px;font-weight:700}
    .box{margin-top:18px;background:#f7f4ee;border-radius:8px;padding:14px;font-size:13px}
    @media print{button{display:none}}
  </style></head><body>
    <div class="top">
      <div><h1>HKGROUP</h1><div class="muted">Dược liệu lên men · duoclieuhk.vn</div></div>
      <div style="text-align:right">
        <div style="font-weight:700">HOÁ ĐƠN</div>
        <div class="muted">Mã: ${order.code}</div>
      </div>
    </div>
    <div style="margin-top:14px;font-size:14px">
      <strong>Khách hàng:</strong> ${escapeHtml(customer.customer_name)}<br/>
      <strong>Điện thoại:</strong> ${escapeHtml(customer.customer_phone)}<br/>
      <strong>Địa chỉ:</strong> ${escapeHtml(customer.address)}
    </div>
    <table>
      <thead><tr><th>Sản phẩm</th><th style="text-align:center">SL</th><th style="text-align:right">Đơn giá</th><th style="text-align:right">Thành tiền</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="tot">Tổng cộng: ${formatVND(order.subtotal_vnd)}</div>
    <div class="box">
      <strong>Thanh toán chuyển khoản</strong><br/>
      ${b.bank_name ? `Ngân hàng: ${escapeHtml(b.bank_name)}<br/>` : ""}
      ${b.account ? `Số TK: ${escapeHtml(b.account)}<br/>` : ""}
      ${b.account_name ? `Chủ TK: ${escapeHtml(b.account_name)}<br/>` : ""}
      Nội dung: <strong>${order.code}</strong>
    </div>
    <p class="muted" style="margin-top:20px">Cảm ơn bạn đã mua hàng tại HKGROUP!</p>
    <button onclick="window.print()" style="margin-top:16px;padding:10px 18px;border:0;border-radius:20px;background:#143021;color:#e8c877;font-weight:600;cursor:pointer">In hoá đơn</button>
  </body></html>`;
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
