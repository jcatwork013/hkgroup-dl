import Link from "next/link";
import { JsonLdScript } from "./JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo";

export type Crumb = { name: string; href: string };

// Breadcrumb DÙNG CHUNG cho mọi trang: <ol> semantic, dấu › nhạt, mục cuối = trang hiện tại
// (không phải link, aria-current, cắt bớt nếu tên dài để không rớt dòng xấu trên mobile).
// Tự phát luôn JSON-LD BreadcrumbList từ CÙNG mảng items → hiển thị và schema.org không bao giờ lệch.
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <JsonLdScript data={breadcrumbJsonLd(items.map((c) => ({ name: c.name, url: c.href })))} />
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-ink/50">
          {items.map((c, i) => {
            const last = i === items.length - 1;
            return (
              <li key={c.href} className="flex min-w-0 items-center gap-x-1.5">
                {i > 0 && (
                  <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink/25">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                )}
                {last ? (
                  <span aria-current="page" className="max-w-[70vw] truncate font-medium text-ink/70 sm:max-w-md">
                    {c.name}
                  </span>
                ) : (
                  <Link href={c.href} className="shrink-0 transition-colors hover:text-gold-600">
                    {c.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
