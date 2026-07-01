import Link from "next/link";
import { BrandMark } from "./BrandMark";
import type { SiteSettings } from "@/lib/settings";

export function Footer({ settings }: { settings: SiteSettings }) {
  const { brand, footer, contact } = settings;
  const social = [
    { href: footer.facebook, label: "Facebook" },
    { href: footer.youtube, label: "YouTube" },
    { href: footer.zalo, label: "Zalo" },
  ].filter((s) => s.href);

  return (
    <footer className="mt-20 bg-forest-950 text-cream-100/70 sm:mt-24">
      <div className="container-hk grid gap-10 py-12 sm:py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <BrandMark brand={brand} size="lg" />
          <p className="mt-5 max-w-sm text-sm leading-relaxed">{footer.about}</p>
          <p className="mt-4 text-xs uppercase tracking-widest text-cream-100/40">{brand.tagline}</p>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-cream-50">Khám phá</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/san-pham" className="hover:text-gold-400">Sản phẩm</Link></li>
            <li><Link href="/affiliate" className="hover:text-gold-400">Chương trình Affiliate</Link></li>
            <li><Link href="/ve-chung-toi" className="hover:text-gold-400">Về chúng tôi</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-cream-50">Liên hệ</h4>
          <ul className="space-y-2 text-sm">
            <li>Hotline: <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="hover:text-gold-400">{contact.phone}</a></li>
            <li><a href={`mailto:${contact.email}`} className="hover:text-gold-400">{contact.email}</a></li>
            <li>{contact.address}</li>
          </ul>
          {social.length > 0 && (
            <div className="mt-4 flex gap-4 text-sm">
              {social.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-gold-400">{s.label}</a>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-cream-100/10 py-5 text-center text-xs text-cream-100/40">
        © {new Date().getFullYear()} {footer.copyright}
      </div>
    </footer>
  );
}
