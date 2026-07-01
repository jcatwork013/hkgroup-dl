"use client";

import Link from "next/link";
import { useCart, setQty, removeItem } from "@/lib/cart";
import { formatVND } from "@/lib/format";
import { ProductImage } from "@/components/ProductImage";
import { CheckoutSteps } from "@/components/CheckoutSteps";

export default function CartPage() {
  const { items, total } = useCart();

  return (
    <div className="container-hk py-12 sm:py-16">
      <h1 className="mb-6 font-serif text-3xl font-bold text-forest-900 sm:text-4xl">Giỏ hàng</h1>
      <CheckoutSteps active={1} />

      {items.length === 0 ? (
        <div className="card mt-8 p-12 text-center">
          <p className="text-ink/50">Giỏ hàng của bạn đang trống.</p>
          <Link href="/san-pham" className="btn btn-gold mt-5 inline-flex px-6 py-2.5 text-sm">
            Khám phá sản phẩm
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            {items.map((it) => (
              <div key={it.id} className="card flex gap-4 p-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-forest-100 to-cream-100">
                  <ProductImage src={it.image} alt={it.name} className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-1 flex-col">
                  <Link href={`/san-pham/${it.slug}`} className="font-serif font-semibold text-forest-900 hover:text-forest-700">
                    {it.name}
                  </Link>
                  <p className="num mt-1 text-sm text-gold-600">{formatVND(it.price_vnd)}</p>
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center rounded-full border border-cream-200">
                      <button onClick={() => setQty(it.id, it.qty - 1)} className="px-3 py-1.5 text-forest-700 hover:text-gold-600" aria-label="Giảm">−</button>
                      <span className="num min-w-[2rem] text-center text-sm font-medium">{it.qty}</span>
                      <button onClick={() => setQty(it.id, it.qty + 1)} className="px-3 py-1.5 text-forest-700 hover:text-gold-600" aria-label="Tăng">+</button>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="num font-semibold text-forest-800">{formatVND(it.price_vnd * it.qty)}</span>
                      <button onClick={() => removeItem(it.id)} className="text-xs text-red-500 hover:underline">Xoá</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="card p-6">
              <h2 className="font-serif text-lg font-semibold text-forest-900">Tóm tắt đơn</h2>
              <div className="mt-4 flex items-center justify-between border-t border-cream-200 pt-4 text-sm">
                <span className="text-ink/60">Tạm tính</span>
                <span className="num font-semibold text-forest-800">{formatVND(total)}</span>
              </div>
              <p className="mt-1 text-xs text-ink/40">Phí vận chuyển tính khi xác nhận đơn.</p>
              <Link href="/thanh-toan" className="btn btn-gold mt-5 block w-full py-3 text-center text-sm">
                Tiến hành thanh toán
              </Link>
              <Link href="/san-pham" className="mt-3 block text-center text-sm text-forest-700 hover:text-gold-600">
                ← Tiếp tục mua sắm
              </Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
