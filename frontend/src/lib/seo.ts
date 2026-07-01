// SEO trung tâm: cấu hình site + builder JSON-LD (schema.org) tái dùng cho mọi trang.
import { SITE_URL } from "./api";

export const SITE = {
  name: "HKGROUP",
  legalName: "Công ty HKGROUP",
  url: SITE_URL,
  description:
    "HKGROUP — dược liệu lên men theo công thức cổ truyền kết hợp công nghệ hiện đại. Sản phẩm chuẩn hoá, truy xuất nguồn gốc, chương trình Affiliate minh bạch.",
  locale: "vi_VN",
  founded: "2019",
  phone: "+84-1900-0000",
  email: "hello@hkgroup.vn",
  sameAs: [
    "https://www.facebook.com/hkgroup",
    "https://www.youtube.com/@hkgroup",
    "https://zalo.me/hkgroup",
  ],
} as const;

type JsonLd = Record<string, unknown>;

export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE.url}/#organization`,
    name: SITE.name,
    legalName: SITE.legalName,
    url: SITE.url,
    logo: `${SITE.url}/icon.svg`,
    foundingDate: SITE.founded,
    description: SITE.description,
    email: SITE.email,
    sameAs: SITE.sameAs,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: SITE.phone,
      contactType: "customer service",
      areaServed: "VN",
      availableLanguage: ["Vietnamese"],
    },
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE.url}/#website`,
    url: SITE.url,
    name: SITE.name,
    inLanguage: "vi-VN",
    publisher: { "@id": `${SITE.url}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/san-pham?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url.startsWith("http") ? it.url : `${SITE.url}${it.url}`,
    })),
  };
}

export function productJsonLd(p: {
  name: string;
  slug: string;
  description: string;
  price: number;
  sku?: string;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    sku: p.sku,
    brand: { "@type": "Brand", name: SITE.name },
    category: "Dược liệu",
    offers: {
      "@type": "Offer",
      priceCurrency: "VND",
      price: p.price,
      availability: "https://schema.org/InStock",
      url: `${SITE.url}/san-pham/${p.slug}`,
      seller: { "@id": `${SITE.url}/#organization` },
    },
  };
}

export function itemListJsonLd(items: { name: string; slug: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: `${SITE.url}/san-pham/${it.slug}`,
    })),
  };
}

export function faqJsonLd(faqs: { q: string; a: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export type { JsonLd };
