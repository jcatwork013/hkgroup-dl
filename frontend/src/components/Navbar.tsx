"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "./BrandMark";
import { useAuth } from "@/lib/invest-auth";
import { useCart, captureRef } from "@/lib/cart";

const links = [
  { href: "/", label: "Trang chủ" },
  { href: "/san-pham", label: "Sản phẩm" },
  { href: "/ve-chung-toi", label: "Về chúng tôi" },
  { href: "/chinh-sach", label: "Chính sách" },
];

type Brand = { name: string; logoUrl: string; tagline: string };

function firstName(full: string): string {
  const p = full.trim().split(/\s+/);
  return p[p.length - 1] || full;
}

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

function CartIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 7h14l-1.2 10.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 7Z" />
      <path d="M9 10V6a3 3 0 0 1 6 0v4" />
    </svg>
  );
}

export function Navbar({ brand, phone }: { brand: Brand; phone?: string }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const path = usePathname() ?? "/";
  const { user } = useAuth(); // realtime — cập nhật ngay khi login/logout
  const { count } = useCart();

  useEffect(() => {
    captureRef(); // lưu ?ref= (affiliate) nếu có
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [path]);

  return (
    <>
      {/* Dải thông tin mảnh — chỉ thông tin có thật (hotline + chính sách giao/đổi trả). */}
      <div className="bg-forest-950 text-[12px] text-cream-100/70">
        <div className="container-hk flex h-9 items-center justify-center gap-6 sm:justify-between">
          <p className="hidden sm:block">Giao hàng toàn quốc 1–3 ngày · Kiểm tra hàng trước khi nhận</p>
          {phone && (
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="num tracking-wide transition-colors hover:text-gold-300">
              Hotline <span className="font-semibold text-gold-300">{phone}</span>
            </a>
          )}
        </div>
      </div>

      <header
        className={`sticky top-0 z-50 border-b bg-cream-50 transition-shadow ${
          scrolled ? "border-cream-200 shadow-[0_8px_30px_-12px_rgba(16,36,23,0.18)]" : "border-transparent"
        }`}
      >
        <nav className="container-hk flex h-16 items-center justify-between md:h-[76px]">
          <Link href="/" aria-label={brand.name} className="shrink-0">
            <BrandMark brand={brand} plain />
          </Link>

          <ul className="hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const active = isActive(path, l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative rounded-full px-4 py-2 text-[14px] font-medium transition-colors ${
                      active ? "text-forest-900" : "text-ink/60 hover:text-forest-900"
                    }`}
                  >
                    {l.label}
                    <span
                      className={`absolute inset-x-4 -bottom-0.5 h-[2px] origin-left rounded-full bg-gold-500 transition-transform duration-300 ${
                        active ? "scale-x-100" : "scale-x-0"
                      }`}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="hidden items-center gap-2 md:flex">
            <Link
              href="/gio-hang"
              aria-label="Giỏ hàng"
              className="relative flex h-11 w-11 items-center justify-center rounded-full text-forest-900 transition-colors hover:bg-forest-900/5"
            >
              <CartIcon />
              {count > 0 && (
                <span className="num absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-forest-950 ring-2 ring-cream-50">
                  {count}
                </span>
              )}
            </Link>
            {user ? (
              <Link
                href="/affiliate"
                className="flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-medium text-forest-900 ring-1 ring-cream-200 transition hover:ring-forest-300"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-800 text-xs font-semibold text-gold-300">
                  {firstName(user.full_name).charAt(0).toUpperCase()}
                </span>
                {firstName(user.full_name)}
              </Link>
            ) : (
              <Link href="/affiliate" className="btn btn-dark px-5 text-sm">
                Đăng nhập
              </Link>
            )}
          </div>

          {/* Cart + Hamburger (mobile) */}
          <div className="flex items-center md:hidden">
            <Link href="/gio-hang" aria-label="Giỏ hàng" className="relative flex h-11 w-11 items-center justify-center text-forest-900">
              <CartIcon />
              {count > 0 && (
                <span className="num absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-forest-950">
                  {count}
                </span>
              )}
            </Link>
            <button
              type="button"
              aria-label={open ? "Đóng menu" : "Mở menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-forest-900"
            >
              <span className="relative block h-3.5 w-5">
                <span className={`absolute left-0 block h-[1.5px] w-5 bg-current transition-all ${open ? "top-1.5 rotate-45" : "top-0"}`} />
                <span className={`absolute left-0 top-1.5 block h-[1.5px] w-5 bg-current transition-all ${open ? "opacity-0" : "opacity-100"}`} />
                <span className={`absolute left-0 block h-[1.5px] w-5 bg-current transition-all ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
              </span>
            </button>
          </div>
        </nav>

        {/* Drawer mobile */}
        {open && (
          <div className="border-t border-cream-200 bg-cream-50 md:hidden">
            <ul className="container-hk flex flex-col py-3">
              {[...links, { href: "/affiliate", label: "Tài khoản" }].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={`flex items-center justify-between border-b border-cream-200/70 py-3.5 text-[15px] font-medium ${
                      isActive(path, l.href) ? "text-forest-900" : "text-ink/70"
                    }`}
                  >
                    {l.label}
                    <span className="text-gold-600" aria-hidden>→</span>
                  </Link>
                </li>
              ))}
              <li className="pt-4">
                <Link href="/affiliate" className="btn btn-dark w-full text-sm">
                  {user ? `Chào, ${firstName(user.full_name)}` : "Đăng nhập / Đăng ký"}
                </Link>
              </li>
            </ul>
          </div>
        )}
      </header>
    </>
  );
}
