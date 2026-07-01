"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart, clearCart, getRef } from "@/lib/cart";
import { submitCheckout, type CheckoutResult } from "@/lib/checkout";
import { formatVND } from "@/lib/format";
import { useAuth } from "@/lib/invest-auth";
import { CheckoutSteps } from "@/components/CheckoutSteps";

export default function CheckoutPage() {
  const { items, total } = useCart();
  const { user } = useAuth();
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", address: "", email: "", note: "" });
  const [prefilled, setPrefilled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<CheckoutResult | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Đã đăng nhập → tự điền họ tên / SĐT / email từ hồ sơ, khách không phải nhập lại.
  // Chỉ điền field đang trống (không đè lên thứ khách vừa sửa).
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      customer_name: f.customer_name || user.full_name || "",
      customer_phone: f.customer_phone || user.phone || "",
      email: f.email || user.email || "",
    }));
    if (user.full_name || user.phone || user.email) setPrefilled(true);
  }, [user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await submitCheckout({
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        address: form.address,
        email: form.email,
        note: form.note,
        ref_code: getRef(),
        items: items.map((i) => ({ product_id: i.id, qty: i.qty })),
      });
      clearCart();
      setDone(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đặt hàng thất bại.");
    } finally {
      setLoading(false);
    }
  }

  // Đặt hàng thành công — hiển thị mã đơn + hướng dẫn chuyển khoản.
  if (done) {
    const b = done.bank;
    return (
      <div className="container-hk max-w-lg py-16">
        <CheckoutSteps active={3} />
        <div className="card p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">✓</div>
          <h1 className="font-serif text-2xl font-bold text-forest-900">Đặt hàng thành công!</h1>
          <p className="mt-2 text-sm text-ink/60">
            Mã đơn: <span className="font-mono font-bold text-forest-800">{done.code}</span>
          </p>
          <div className="mt-6 rounded-xl border border-cream-200 bg-cream-50 p-5 text-left text-sm">
            <p className="mb-3 text-center font-semibold text-forest-900">Quét mã QR để thanh toán</p>
            {b.bank_code && b.account ? (
              <div className="flex flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://img.vietqr.io/image/${encodeURIComponent(b.bank_code)}-${encodeURIComponent(b.account)}-compact2.png?amount=${done.subtotal_vnd}&addInfo=${encodeURIComponent("Mua san pham " + done.code)}&accountName=${encodeURIComponent(b.account_name || "")}`}
                  alt="QR chuyển khoản"
                  className="h-56 w-56 rounded-lg bg-white object-contain p-1 shadow-sm"
                />
                <p className="mt-2 text-xs text-ink/50">Nội dung: “Mua san pham {done.code}”</p>
              </div>
            ) : null}
            <div className="mt-4 space-y-1 border-t border-cream-200 pt-3 text-ink/70">
              <p>Số tiền: <span className="num font-semibold text-forest-800">{formatVND(done.subtotal_vnd)}</span></p>
              {b.bank_name && <p>Ngân hàng: <strong>{b.bank_name}</strong></p>}
              {b.account && <p>Số tài khoản: <strong className="font-mono">{b.account}</strong></p>}
              {b.account_name && <p>Chủ tài khoản: <strong>{b.account_name}</strong></p>}
              <p>Nội dung CK: <strong className="font-mono">Mua san pham {done.code}</strong></p>
            </div>
          </div>
          {form.email && (
            <p className="mt-3 text-xs text-green-700">✓ Hoá đơn đã được gửi tới email {form.email}.</p>
          )}
          <p className="mt-4 text-xs text-ink/50">
            Chúng tôi sẽ liên hệ xác nhận &amp; giao hàng sau khi nhận thanh toán. Cảm ơn bạn!
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/san-pham" className="btn btn-gold inline-flex px-6 py-2.5 text-sm">Tiếp tục mua sắm</Link>
            {user && (
              <Link href="/affiliate" className="inline-flex px-4 py-2.5 text-sm font-medium text-forest-700 hover:text-gold-600">
                Xem đơn hàng của tôi →
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container-hk max-w-lg py-16 text-center">
        <p className="text-ink/50">Giỏ hàng trống — chưa thể thanh toán.</p>
        <Link href="/san-pham" className="btn btn-gold mt-5 inline-flex px-6 py-2.5 text-sm">Khám phá sản phẩm</Link>
      </div>
    );
  }

  return (
    <div className="container-hk py-12 sm:py-16">
      <h1 className="mb-6 font-serif text-3xl font-bold text-forest-900 sm:text-4xl">Thanh toán</h1>
      <CheckoutSteps active={2} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <form onSubmit={submit} className="card space-y-4 p-6">
          <div>
            <h2 className="font-serif text-lg font-semibold text-forest-900">Thông tin nhận hàng</h2>
            {prefilled && (
              <p className="mt-1 text-xs text-forest-600">✓ Đã tự điền từ tài khoản của bạn — chỉ cần kiểm tra &amp; bổ sung địa chỉ.</p>
            )}
          </div>
          <label className="block">
            <span className="f-label">Họ và tên</span>
            <input className="f-input" value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} required />
          </label>
          <label className="block">
            <span className="f-label">Số điện thoại</span>
            <input className="f-input" value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} required />
          </label>
          <label className="block">
            <span className="f-label">Địa chỉ nhận hàng</span>
            <input className="f-input" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" required />
          </label>
          <label className="block">
            <span className="f-label">Email nhận hoá đơn (tuỳ chọn)</span>
            <input type="email" className="f-input" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@vidu.com" />
          </label>
          <label className="block">
            <span className="f-label">Ghi chú (tuỳ chọn)</span>
            <textarea className="f-input" rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn btn-gold w-full py-3 text-sm disabled:opacity-60">
            {loading ? "Đang đặt hàng..." : `Đặt hàng · ${formatVND(total)}`}
          </button>
          <p className="text-center text-xs text-ink/40">
            Thanh toán chuyển khoản sau khi đặt. Chúng tôi sẽ liên hệ xác nhận.
          </p>
        </form>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h2 className="font-serif text-lg font-semibold text-forest-900">Đơn của bạn</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span className="text-ink/70">{i.name} <span className="text-ink/40">× {i.qty}</span></span>
                  <span className="num shrink-0 font-medium text-forest-800">{formatVND(i.price_vnd * i.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t border-cream-200 pt-4">
              <span className="text-sm text-ink/60">Tạm tính</span>
              <span className="num text-lg font-bold text-forest-800">{formatVND(total)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
