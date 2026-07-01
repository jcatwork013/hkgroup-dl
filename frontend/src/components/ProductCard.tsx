import Link from "next/link";
import type { ProductListItem } from "@/lib/api";
import { formatVND } from "@/lib/format";
import { ProductImage } from "./ProductImage";
import { AddToCart } from "./AddToCart";
import { ShareAffiliate } from "./ShareAffiliate";

export function ProductCard({ p }: { p: ProductListItem }) {
  const img = p.images?.[0];
  return (
    <Link
      href={`/san-pham/${p.slug}`}
      className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-lg focus-within:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-forest-100 to-cream-100">
        <ProductImage
          src={img}
          alt={p.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="font-serif text-base font-semibold text-forest-900 group-hover:text-forest-700 sm:text-lg">
          {p.name}
        </h3>
        <p className="mt-1 line-clamp-2 flex-1 text-sm text-ink/60">{p.short_desc}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="num text-base font-bold text-forest-800 sm:text-lg">{formatVND(p.min_price_vnd)}</span>
          <AddToCart
            product={{ id: p.id, slug: p.slug, name: p.name, price_vnd: p.min_price_vnd, image: p.images?.[0] }}
          />
        </div>
        <div className="mt-2">
          <ShareAffiliate slug={p.slug} compact />
        </div>
      </div>
    </Link>
  );
}
