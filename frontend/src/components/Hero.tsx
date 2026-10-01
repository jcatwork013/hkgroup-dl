import Link from "next/link";
import type { SiteSettings } from "@/lib/settings";
import type { ProductListItem } from "@/lib/api";
import { formatVND } from "@/lib/format";

// Hero 2 cột: thông điệp bên trái, ẢNH SẢN PHẨM THẬT (catalog từ admin) bên phải —
// không dùng ảnh minh hoạ stock. Không có sản phẩm → chỉ còn cột chữ.
export function Hero({ settings, products = [] }: { settings: SiteSettings; products?: ProductListItem[] }) {
  const { hero, stats } = settings;
  const show = products.filter((p) => p.images?.[0]).slice(0, 3);
  const [main, ...rest] = show;

  return (
    <section className="hero-bg overflow-hidden">
      <div className="container-hk grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-24">
        <div>
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-400/25 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-gold-300 animate-fade-up">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
            {hero.eyebrow}
          </p>
          <h1 className="max-w-xl font-serif text-[2.3rem] font-semibold leading-[1.08] text-cream-50 animate-fade-up delay-1 sm:text-5xl lg:text-[3.6rem]">
            {hero.titleLead} <span className="italic text-gold-300">{hero.titleAccent}</span> {hero.titleRest}
          </h1>
          <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-cream-100/70 animate-fade-up delay-2 sm:text-[17px]">
            {hero.subtitle}
          </p>
          <div className="mt-9 flex flex-col gap-3 animate-fade-up delay-3 sm:flex-row">
            <Link href="/san-pham" className="btn btn-gold group px-7 text-sm shadow-lg shadow-black/25">
              {hero.ctaPrimary}
              <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>→</span>
            </Link>
            <Link href="/affiliate" className="btn btn-outline-cream px-7 text-sm">
              {hero.ctaSecondary}
            </Link>
          </div>

          {stats.length > 0 && (
            <dl className="mt-12 flex max-w-lg divide-x divide-cream-100/10 border-t border-cream-100/10 pt-7">
              {stats.map((st) => (
                <div key={st.label} className="min-w-0 flex-1 px-3 first:pl-0 sm:px-5">
                  <dt className="num whitespace-nowrap font-serif text-xl font-semibold text-cream-50 sm:text-[1.7rem]">{st.value}</dt>
                  <dd className="mt-1 text-[10px] uppercase leading-snug tracking-[0.12em] text-cream-100/45 sm:text-[11px]">{st.label}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {main && (
          <div className="relative mx-auto w-full max-w-[520px] animate-fade-up delay-2 lg:max-w-none">
            {/* vầng sáng sau ảnh */}
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gold-400/10 blur-3xl" aria-hidden />
            <Link
              href={`/san-pham/${main.slug}`}
              className="group block overflow-hidden rounded-[1.75rem] bg-white shadow-2xl shadow-black/40 ring-1 ring-white/10"
            >
              <div className="aspect-[5/4] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={main.images![0]}
                  alt={main.name}
                  fetchPriority="high"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-600">Nổi bật</p>
                  <p className="mt-0.5 truncate font-semibold text-forest-900">{main.name}</p>
                </div>
                <span className="num shrink-0 text-lg font-bold text-forest-800">{formatVND(main.min_price_vnd)}</span>
              </div>
            </Link>

            {rest.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-4 lg:absolute lg:-left-14 lg:bottom-28 lg:mt-0 lg:w-[34%] lg:grid-cols-1">
                {rest.map((p) => (
                  <Link
                    key={p.id}
                    href={`/san-pham/${p.slug}`}
                    className="group flex items-center gap-3 rounded-2xl bg-cream-50/95 p-2.5 pr-3 shadow-xl shadow-black/30 ring-1 ring-black/5 backdrop-blur transition hover:-translate-y-0.5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.images![0]} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-forest-900">{p.name}</p>
                      <p className="num text-xs text-ink/55">{formatVND(p.min_price_vnd)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
