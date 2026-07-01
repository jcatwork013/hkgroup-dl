"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandMark } from "./BrandMark";

const links = [
  { href: "/", label: "Trang chủ" },
  { href: "/san-pham", label: "Sản phẩm" },
  { href: "/affiliate", label: "Affiliate" },
  { href: "/ve-chung-toi", label: "Về chúng tôi" },
];

type Brand = { name: string; logoUrl: string; tagline: string };

export function Navbar({ brand }: { brand: Brand }) {
  const [open, setOpen] = useState(false);
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

        <div className="hidden md:block">
          <Link href="/affiliate" className="btn btn-gold px-5 py-2 text-sm">Trở thành Affiliate</Link>
        </div>

        {/* Hamburger mobile */}
        <button
          type="button"
          aria-label={open ? "Đóng menu" : "Mở menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-cream-50 md:hidden"
        >
          <span className="relative block h-4 w-6">
            <span className={`absolute left-0 block h-0.5 w-6 bg-current transition-all ${open ? "top-1.5 rotate-45" : "top-0"}`} />
            <span className={`absolute left-0 top-1.5 block h-0.5 w-6 bg-current transition-all ${open ? "opacity-0" : "opacity-100"}`} />
            <span className={`absolute left-0 block h-0.5 w-6 bg-current transition-all ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
          </span>
        </button>
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
                Trở thành Affiliate
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
