"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "./BrandMark";
import { useAuth } from "@/lib/invest-auth";
import { useCart, captureRef } from "@/lib/cart";

const links = [
  { href: "/", label: "Trang chủ" },
  { href: "/san-pham", label: "Sản phẩm" },
  { href: "/affiliate", label: "Tài khoản" },
  { href: "/ve-chung-toi", label: "Về chúng tôi" },
];

type Brand = { name: string; logoUrl: string; tagline: string };

function firstName(full: string): string {
  const p = full.trim().split(/\s+/);
  return p[p.length - 1] || full;
}

export function Navbar({ brand }: { brand: Brand }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth(); // realtime — cập nhật ngay khi login/logout
  const { count } = useCart();

  useEffect(() => {
    captureRef(); // lưu ?ref= (affiliate) nếu có
  }, []);
  return (
    <header className="sticky top-0 z-50 border-b border-forest-800/20 bg-forest-950/90 backdrop-blur">
      <nav className="container-hk flex h-[70px] items-center justify-between md:h-20">
        <Link href="/" aria-label={brand.name} onClick={() => setOpen(false)}>
          <BrandMark brand={brand} />
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="text-sm font-medium text-cream-100/80 transition-colors hover:text-gold-400">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-4 md:flex">
          <Link href="/gio-hang" aria-label="Giỏ hàng" className="relative text-cream-100/80 transition-colors hover:text-gold-400">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" />
              <path d="M2 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L23 6H5" />
            </svg>
            {count > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-gold-500 px-1 text-[11px] font-bold text-forest-950">
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <Link href="/affiliate" className="flex items-center gap-2 rounded-full border border-gold-400/40 px-4 py-2 text-sm text-cream-50 transition-colors hover:border-gold-400">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-500 text-xs font-bold text-forest-950">
                {firstName(user.full_name).charAt(0).toUpperCase()}
              </span>
              Chào, {firstName(user.full_name)}
            </Link>
          ) : (
            <Link href="/affiliate" className="btn btn-gold px-5 py-2 text-sm">Đăng nhập</Link>
          )}
        </div>

        {/* Cart + Hamburger (mobile) */}
        <div className="flex items-center gap-1 md:hidden">
          <Link href="/gio-hang" aria-label="Giỏ hàng" onClick={() => setOpen(false)} className="relative flex h-11 w-11 items-center justify-center text-cream-50">
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" />
              <path d="M2 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L23 6H5" />
            </svg>
            {count > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-forest-950">
                {count}
              </span>
            )}
          </Link>
          <button
            type="button"
            aria-label={open ? "Đóng menu" : "Mở menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-cream-50"
          >
          <span className="relative block h-4 w-6">
            <span className={`absolute left-0 block h-0.5 w-6 bg-current transition-all ${open ? "top-1.5 rotate-45" : "top-0"}`} />
            <span className={`absolute left-0 top-1.5 block h-0.5 w-6 bg-current transition-all ${open ? "opacity-0" : "opacity-100"}`} />
            <span className={`absolute left-0 block h-0.5 w-6 bg-current transition-all ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
          </span>
          </button>
        </div>
      </nav>

      {/* Drawer mobile */}
      {open && (
        <div className="border-t border-forest-800/30 bg-forest-950 md:hidden">
          <ul className="container-hk flex flex-col py-2">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-base font-medium text-cream-100/90 hover:text-gold-400"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="py-3">
              <Link href="/affiliate" onClick={() => setOpen(false)} className="btn btn-gold w-full py-3 text-sm">
                {user ? `Chào, ${firstName(user.full_name)}` : "Đăng nhập"}
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
