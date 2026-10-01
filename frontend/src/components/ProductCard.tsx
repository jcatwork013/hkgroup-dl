import Link from "next/link";
import type { ProductListItem } from "@/lib/api";
import { formatVND } from "@/lib/format";
import { ProductImage } from "./ProductImage";
import { AddToCart } from "./AddToCart";
import { ShareAffiliate } from "./ShareAffiliate";

export function ProductCard({ p }: { p: ProductListItem }) {
  const img = p.images?.[0];
  const second = p.images?.[1];
  const count = p.images?.length ?? 0;
  return (
    <Link
      href={`/san-pham/${p.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[1.25rem] bg-white ring-1 ring-cream-200 transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-24px_rgba(16,36,23,0.35)] hover:ring-cream-200/0"
    >
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-forest-50 to-cream-100">
        <ProductImage
          src={img}
          alt={p.name}
          className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
        />
        {/* Xem trước: rê chuột → ảnh thứ 2 hiện lên (desktop). */}
        {second && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={second}
            alt=""
            aria-hidden
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-700 ease-out group-hover:scale-[1.04] group-hover:opacity-100 max-sm:hidden"
          />
        )}
        {(count > 1 || p.video_url) && (
          <div className="pointer-events-none absolute bottom-3 left-3 flex gap-1.5">
            {count > 1 && (
              <span className="num flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 16l5-5 4 4 3-3 6 6" strokeLinejoin="round" />
                </svg>
                {count}
              </span>
            )}
            {p.video_url && (
              <span className="flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
                  <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
                </svg>
                Video
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-forest-900 sm:text-base">{p.name}</h3>
        <p className="mt-1.5 line-clamp-2 flex-1 text-[13px] leading-relaxed text-ink/50">{p.short_desc}</p>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-cream-200/80 pt-4">
          <span className="num text-[17px] font-bold tracking-tight text-forest-900">{formatVND(p.min_price_vnd)}</span>
          <AddToCart
            product={{ id: p.id, slug: p.slug, name: p.name, price_vnd: p.min_price_vnd, image: p.images?.[0] }}
          />
        </div>
        <div className="empty:hidden">
          <ShareAffiliate slug={p.slug} compact />
        </div>
      </div>
    </Link>
  );
}
