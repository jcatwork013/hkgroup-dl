"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addToCart, type CartItem } from "@/lib/cart";

type Props = {
  product: Omit<CartItem, "qty">;
  variant?: "card" | "buy";
};

// Nút thêm vào giỏ. variant "card" = nút nhỏ trong ProductCard (nằm trong <Link> nên phải chặn nav);
// "buy" = cụm nút "Mua ngay" + "Thêm vào giỏ" ở trang chi tiết.
export function AddToCart({ product, variant = "card" }: Props) {
  const [added, setAdded] = useState(false);
  const router = useRouter();

  function add(go: boolean, e?: React.MouseEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    addToCart(product);
    if (go) router.push("/gio-hang");
    else {
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    }
  }

  if (variant === "buy") {
    return (
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button onClick={() => add(true)} className="btn btn-gold px-8 py-3 text-sm">
          Mua ngay
        </button>
        <button
          onClick={() => add(false)}
          className="rounded-full border border-forest-300 px-8 py-3 text-sm font-medium text-forest-800 transition-colors hover:bg-forest-50"
        >
          {added ? "Đã thêm ✓" : "Thêm vào giỏ"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => add(false, e)}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
        added ? "bg-green-100 text-green-700" : "bg-forest-800 text-gold-300 hover:bg-forest-700"
      }`}
    >
      {added ? (
        "Đã thêm ✓"
      ) : (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" />
            <path d="M2 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L23 6H5" />
          </svg>
          Thêm
        </>
      )}
    </button>
  );
}
