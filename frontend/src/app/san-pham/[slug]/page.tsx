import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { ProductGallery } from "@/components/ProductGallery";
import { ExpandableText } from "@/components/ExpandableText";
import { AddToCart } from "@/components/AddToCart";
import { ShareAffiliate } from "@/components/ShareAffiliate";
import { JsonLdScript } from "@/components/JsonLd";
import { getProduct, getProducts, SITE_URL } from "@/lib/api";
import { formatVND } from "@/lib/format";
import { productJsonLd } from "@/lib/seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";

type Props = { params: Promise<{ slug: string }> };

const SPECS = [
  ["Cam kết", "warranty", "M12 3l7 3v5c0 4.5-3 8.2-7 9.5C8 19.2 5 15.5 5 11V6l7-3zM9 12l2 2 4-4"],
  ["Truy xuất", "trace", "M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M11 8v8M14 8v8M17 8v8"],
  ["Giao hàng", "delivery", "M3 7h11v9H3zM14 10h4l3 3v3h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"],
  ["Đổi trả", "return", "M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4"],
] as const;

// Mô tả admin nhập là text thô: tách đoạn theo dòng trống, dòng VIẾT HOA ngắn → tiêu đề nhỏ,
// bỏ dòng đầu "Mô tả chi tiết"/tên sản phẩm bị lặp với heading của section.
function formatDescription(raw: string, name: string): { text: string; heading: boolean }[] {
  const lines = raw.replace(/\r/g, "").split("\n");
  const norm = (t: string) => t.trim().toLowerCase();
  while (lines.length && (norm(lines[0]!) === "" || norm(lines[0]!) === "mô tả chi tiết" || norm(lines[0]!) === norm(name))) lines.shift();
  const out: { text: string; heading: boolean }[] = [];
  let buf: string[] = [];
  const flush = () => {
    const t = buf.join("\n").trim();
    if (t) out.push({ text: t, heading: false });
    buf = [];
  };
  for (const line of lines) {
    const t = line.trim();
    const isHeading = t.length >= 4 && t.length <= 90 && /\p{L}/u.test(t) && t === t.toLocaleUpperCase("vi") && !/[.!]$/.test(t);
    if (t === "") flush();
    else if (isHeading) {
      flush();
      out.push({ text: t, heading: true });
    } else buf.push(line);
  }
  flush();
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return { title: "Không tìm thấy sản phẩm", robots: { index: false } };
  const title = p.meta_title || p.name;
  const desc = p.meta_description || p.short_desc;
  return {
    title,
    description: desc,
    alternates: { canonical: `/san-pham/${p.slug}` },
    openGraph: {
      title,
      description: desc,
      type: "website",
      url: `${SITE_URL}/san-pham/${p.slug}`,
      images: p.images?.length ? [{ url: p.images[0]! }] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const [p, all] = await Promise.all([getProduct(slug), getProducts()]);
  if (!p) notFound();

  const price = p.price_vnd;
  const images = p.images ?? [];
  const related = all.filter((x) => x.slug !== p.slug).slice(0, 3);
  const description = formatDescription(p.description, p.name);

  return (
    <div className="container-hk py-10 sm:py-16">
      <JsonLdScript
        data={[
          productJsonLd({
            name: p.name,
            slug: p.slug,
            description: p.short_desc || p.meta_description,
            price: price,
            sku: p.sku,
          }),
        ]}
      />

      <Breadcrumbs
        items={[
          { name: "Trang chủ", href: "/" },
          { name: "Sản phẩm", href: "/san-pham" },
          { name: p.name, href: `/san-pham/${p.slug}` },
        ]}
      />

      <div className="grid gap-8 md:grid-cols-2 md:gap-12 lg:gap-16">
        <ProductGallery images={images} video={p.video_url} name={p.name} />

        {/* Info */}
        <div className="min-w-0">
          {p.badge && (
            <span className="mb-3 inline-block rounded-full bg-gold-100 px-3 py-1 text-xs font-semibold text-gold-700">
              {p.badge}
            </span>
          )}
          <h1 className="font-serif text-3xl font-bold leading-tight text-forest-900 sm:text-4xl">{p.name}</h1>
          <p className="num mt-4 text-3xl font-bold text-forest-800">{formatVND(price)}</p>

          {p.short_desc && <ExpandableText text={p.short_desc} lines={4} className="mt-5" />}

          <div className="mt-6 border-t border-cream-200 pt-6">
            <AddToCart
              variant="buy"
              product={{ id: p.id, slug: p.slug, name: p.name, price_vnd: price, image: images[0] }}
            />
            <div className="mt-4">
              <ShareAffiliate slug={p.slug} />
            </div>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-3 text-sm">
            {SPECS.map(([label, key, icon]) => (
              <div key={key} className="flex items-start gap-3 rounded-xl bg-cream-100/70 p-3.5 ring-1 ring-cream-200">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-forest-600" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                  <path d={icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="min-w-0">
                  <dt className="text-xs text-ink/45">{label}</dt>
                  <dd className="mt-0.5 font-medium text-forest-900">{p.specs[key]}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Mô tả chi tiết */}
      {description.length > 0 && (
        <section id="mo-ta" className="mt-14 sm:mt-20">
          <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-cream-200 sm:p-10">
            <h2 className="font-serif text-2xl font-semibold text-forest-900">Mô tả chi tiết</h2>
            <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-ink/75">
              {description.map((b, i) =>
                b.heading ? (
                  <h3 key={i} className="pt-2 font-serif text-lg font-semibold text-forest-800">{b.text}</h3>
                ) : (
                  <p key={i} className="whitespace-pre-line">{b.text}</p>
                ),
              )}
            </div>
          </div>
        </section>
      )}

      {/* Liên quan */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-serif text-2xl font-bold text-forest-900">Sản phẩm liên quan</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((rp) => (
              <ProductCard key={rp.id} p={rp} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
