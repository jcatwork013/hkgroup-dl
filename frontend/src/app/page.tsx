import Link from "next/link";
import { Hero } from "@/components/Hero";
import { ProductCard } from "@/components/ProductCard";
import { Process, WhyUs, Testimonials, FAQ, CtaBand, SectionHeading } from "@/components/Sections";
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
      <Hero settings={settings} />

      {/* Featured products */}
      <section className="container-hk py-16 sm:py-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <SectionHeading eyebrow="Sản phẩm nổi bật" title="Tinh tuyển dược liệu" />
          <Link href="/san-pham" className="shrink-0 text-sm font-medium text-forest-700 hover:text-gold-600">
            Xem tất cả →
          </Link>
        </div>
        {featured.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p, i) => (
              <Reveal key={p.id} delay={(i % 3) * 90}>
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
      <Testimonials />
      <FAQ faqs={settings.faq} />
      <CtaBand phone={settings.contact.phone} />
    </>
  );
}
