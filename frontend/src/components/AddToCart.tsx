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
      <div className="flex flex-col gap-3 sm:flex-row">
        <button onClick={() => add(true)} className="btn btn-dark flex-1 px-8 text-[15px] sm:flex-none sm:min-w-[180px]">
          Mua ngay
        </button>
        <button
          onClick={() => add(false)}
          className="btn btn-ghost flex-1 px-8 text-[15px] sm:flex-none sm:min-w-[180px]"
        >
          {added ? "Đã thêm ✓" : "Thêm vào giỏ"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => add(false, e)}
      aria-label={added ? "Đã thêm vào giỏ" : `Thêm ${product.name} vào giỏ`}
      title={added ? "Đã thêm vào giỏ" : "Thêm vào giỏ"}
      className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
        added
          ? "bg-forest-600 text-cream-50"
          : "bg-forest-900 text-cream-50 hover:scale-105 hover:bg-forest-700"
      }`}
    >
      {added ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m5 12 4.5 4.5L19 7" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )}
    </button>
  );
}
