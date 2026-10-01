import Link from "next/link";
import { Hero } from "@/components/Hero";
import { ProductCard } from "@/components/ProductCard";
import { Process, WhyUs, FAQ, CtaBand, SectionHeading } from "@/components/Sections";
import { Reveal } from "@/components/Reveal";
import { JsonLdScript } from "@/components/JsonLd";
import { getProducts } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { faqJsonLd } from "@/lib/seo";

export default async function HomePage() {
  const [products, settings] = await Promise.all([getProducts(), getSettings()]);
  const featured = products.slice(0, 6);

  return (
    <>
      {settings.faq.length > 0 && <JsonLdScript data={faqJsonLd(settings.faq)} />}
      <Hero settings={settings} products={products} />

      {/* Featured products */}
      <section className="container-hk py-20 sm:py-28">
        <div className="mb-10 flex items-end justify-between gap-6 sm:mb-12">
          <SectionHeading eyebrow="Sản phẩm nổi bật" title="Tinh tuyển dược liệu" />
          <Link href="/san-pham" className="btn btn-ghost hidden shrink-0 px-5 text-sm sm:inline-flex">
            Xem tất cả
            <span aria-hidden>→</span>
          </Link>
        </div>
        {featured.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p, i) => (
              <Reveal key={p.id} delay={(i % 3) * 90} className="h-full">
                <ProductCard p={p} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="card p-10 text-center text-ink/50">Chưa có sản phẩm.</div>
        )}
      </section>

      <Process />
      <WhyUs />
      <FAQ faqs={settings.faq} />
      <CtaBand phone={settings.contact.phone} />
    </>
  );
}
