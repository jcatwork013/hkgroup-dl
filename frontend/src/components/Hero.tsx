import Link from "next/link";
import type { SiteSettings } from "@/lib/settings";

export function Hero({ settings }: { settings: SiteSettings }) {
  const { hero, stats } = settings;
  return (
    <section className="hero-bg overflow-hidden">
      <div className="container-hk py-20 sm:py-24 md:py-32">
        <p className="mb-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-gold-400 sm:text-xs animate-fade-up">
          <span className="h-px w-8 bg-gold-500/70" />
          {hero.eyebrow}
        </p>
        <h1 className="max-w-3xl font-serif text-[2rem] font-bold leading-[1.1] text-cream-50 animate-fade-up delay-1 sm:text-5xl md:text-6xl">
          {hero.titleLead} <span className="italic text-gold-400">{hero.titleAccent}</span> {hero.titleRest}
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-cream-100/75 animate-fade-up delay-2 sm:mt-6 sm:text-lg">
          {hero.subtitle}
        </p>
        <div className="mt-8 flex flex-col gap-3 animate-fade-up delay-3 sm:mt-10 sm:flex-row sm:gap-4">
          <Link href="/san-pham" className="btn btn-gold px-7 py-3 text-sm shadow-lg shadow-black/20">
            {hero.ctaPrimary}
          </Link>
          <Link href="/affiliate" className="btn btn-outline-cream px-7 py-3 text-sm">
            {hero.ctaSecondary}
          </Link>
        </div>

        {stats.length > 0 && (
          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-4 border-t border-cream-100/15 pt-8 sm:mt-16">
            {stats.map((st) => (
              <div key={st.label}>
                <dt className="num font-serif text-2xl font-bold text-gold-400 sm:text-3xl">{st.value}</dt>
                <dd className="mt-1 text-[11px] text-cream-100/60 sm:text-xs">{st.label}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
