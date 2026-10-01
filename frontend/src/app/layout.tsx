import type { Metadata, Viewport } from "next";
import { Playfair_Display, Be_Vietnam_Pro } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PolicyHighlights } from "@/components/PolicyHighlights";
import { BackToTop } from "@/components/BackToTop";
import { JsonLdScript } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin", "vietnamese"],
  variable: "--font-playfair",
  display: "swap",
});
const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bevn",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#143021",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// SEO: title/description/keywords/OG lấy từ CMS (admin sửa được).
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: s.seo.title, template: s.seo.titleTemplate },
    description: s.seo.description,
    keywords: s.seo.keywords,
    applicationName: s.brand.name,
    authors: [{ name: s.brand.name }],
    // Favicon + OG share image lấy từ logo thương hiệu (admin sửa được qua brand.logoUrl).
    icons: s.brand.logoUrl
      ? { icon: s.brand.logoUrl, shortcut: s.brand.logoUrl, apple: s.brand.logoUrl }
      : undefined,
    openGraph: {
      type: "website",
      locale: "vi_VN",
      siteName: s.brand.name,
      title: s.seo.title,
      description: s.seo.description,
      url: SITE_URL,
      images: s.brand.logoUrl ? [{ url: s.brand.logoUrl, alt: s.brand.name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: s.seo.title,
      description: s.seo.description,
      images: s.brand.logoUrl ? [s.brand.logoUrl] : undefined,
    },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
    alternates: { canonical: SITE_URL },
    formatDetection: { telephone: true },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <html lang="vi" className={`${playfair.variable} ${beVietnam.variable}`}>
      <body className="flex min-h-screen flex-col">
        {/* Không có JS -> hiện toàn bộ nội dung reveal (an toàn SEO & accessibility) */}
        <noscript>
          <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        <JsonLdScript data={[organizationJsonLd(), websiteJsonLd()]} />
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-forest-900 focus:px-4 focus:py-2 focus:text-cream-50">
          Bỏ qua tới nội dung
        </a>
        <Navbar brand={s.brand} phone={s.contact.phone} />
        <main id="main" className="flex-1">{children}</main>
        <PolicyHighlights />
        <Footer settings={s} />
        <BackToTop />
      </body>
    </html>
  );
}
