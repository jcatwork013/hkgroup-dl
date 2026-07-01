import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { JsonLdScript } from "@/components/JsonLd";
import { getProduct, getProducts, SITE_URL } from "@/lib/api";
import { formatVND } from "@/lib/format";
import { productJsonLd, breadcrumbJsonLd } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

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

  const minPrice = p.variants.length > 0 ? Math.min(...p.variants.map((v) => v.price_vnd)) : 0;
  const images = p.images ?? [];
  const related = all.filter((x) => x.slug !== p.slug).slice(0, 3);

  return (
    <div className="container-hk py-10 sm:py-16">
      <JsonLdScript
        data={[
          breadcrumbJsonLd([
            { name: "Trang chủ", url: "/" },
            { name: "Sản phẩm", url: "/san-pham" },
            { name: p.name, url: `/san-pham/${p.slug}` },
          ]),
          productJsonLd({
            name: p.name,
            slug: p.slug,
            description: p.short_desc || p.meta_description,
            price: minPrice,
            sku: p.variants[0]?.sku,
          }),
        ]}
      />

      <nav aria-label="breadcrumb" className="mb-5 text-sm text-ink/50">
        <Link href="/" className="hover:text-gold-600">Trang chủ</Link> <span className="px-1">/</span>
        <Link href="/san-pham" className="hover:text-gold-600"> Sản phẩm</Link> <span className="px-1">/</span>
        <span className="text-ink/70"> {p.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        {/* Gallery */}
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-forest-100 to-cream-100">
            {images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[0]} alt={p.name} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-serif text-7xl text-forest-300/50">HK</span>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {images.slice(0, 4).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt={`${p.name} ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <h1 className="font-serif text-3xl font-bold text-forest-900 sm:text-4xl">{p.name}</h1>
          <p className="mt-3 text-ink/60">{p.short_desc}</p>
          <p className="num mt-6 text-3xl font-bold text-forest-800">{formatVND(minPrice)}</p>

          {p.variants.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-ink/70">Quy cách</p>
              <div className="flex flex-wrap gap-3">
                {p.variants.map((v) => (
                  <div key={v.id} className="card px-4 py-3">
                    <p className="text-sm font-medium text-forest-900">{v.name}</p>
                    <p className="num text-sm text-gold-600">{formatVND(v.price_vnd)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="btn btn-gold mt-8 w-full px-8 py-3 text-sm sm:w-auto">Mua ngay</button>

          <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-cream-200 pt-6 text-sm">
            <div><dt className="text-ink/40">Cam kết</dt><dd className="mt-0.5 font-medium text-forest-900">Chính hãng 100%</dd></div>
            <div><dt className="text-ink/40">Truy xuất</dt><dd className="mt-0.5 font-medium text-forest-900">Theo từng lô</dd></div>
            <div><dt className="text-ink/40">Giao hàng</dt><dd className="mt-0.5 font-medium text-forest-900">Hub theo khu vực</dd></div>
            <div><dt className="text-ink/40">Đổi trả</dt><dd className="mt-0.5 font-medium text-forest-900">Trong 7 ngày</dd></div>
          </dl>
        </div>
      </div>

      {/* Mô tả chi tiết */}
      {p.description && (
        <section className="mt-12 max-w-3xl">
          <h2 className="font-serif text-xl font-semibold text-forest-900">Mô tả chi tiết</h2>
          <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink/70">{p.description}</p>
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
