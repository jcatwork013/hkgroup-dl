// Cấu hình site cho duoclieuhk.vn. NGUỒN: admin CMS bên invest (admin.duoclieuhk.vn)
// qua GET /api/v1/settings (contact + năm thành lập). Các field invest chưa quản lý
// (SEO/hero/FAQ...) tạm dùng default; sẽ chuyển dần về admin invest (sync ổn trước, gộp sau).
const INVEST_PUBLIC_URL = process.env.NEXT_PUBLIC_INVEST_API_URL ?? "http://localhost:8080";
const INVEST_SERVER_URL = process.env.INVEST_INTERNAL_API_URL ?? INVEST_PUBLIC_URL;

export type SiteSettings = {
  seo: { title: string; titleTemplate: string; description: string; keywords: string };
  brand: { name: string; logoUrl: string; tagline: string };
  hero: {
    eyebrow: string; titleLead: string; titleAccent: string; titleRest: string;
    subtitle: string; ctaPrimary: string; ctaSecondary: string;
  };
  stats: { value: string; label: string }[];
  contact: { phone: string; email: string; address: string };
  footer: { about: string; copyright: string; facebook: string; youtube: string; zalo: string };
  faq: { q: string; a: string }[];
};

export const DEFAULT_SETTINGS: SiteSettings = {
  seo: {
    title: "HKGROUP — Dược liệu lên men, tinh hoa từ thiên nhiên Việt",
    titleTemplate: "%s · HKGROUP",
    description:
      "HKGROUP — dược liệu lên men theo công thức cổ truyền kết hợp công nghệ hiện đại. Sản phẩm chuẩn hoá, truy xuất nguồn gốc, chương trình Affiliate minh bạch.",
    keywords: "dược liệu, lên men, thảo dược, HKGROUP, sức khỏe",
  },
  brand: { name: "HKGROUP", logoUrl: "/logo.png", tagline: "Since 2026" },
  hero: {
    eyebrow: "HKGROUP · Since 2026",
    titleLead: "Dược liệu lên men,",
    titleAccent: "tinh hoa",
    titleRest: "từ thiên nhiên Việt",
    subtitle:
      "Công thức cổ truyền kết hợp công nghệ lên men hiện đại — mang lại sự cân bằng cho cơ thể mỗi ngày.",
    ctaPrimary: "Khám phá sản phẩm",
    ctaSecondary: "Trở thành Affiliate",
  },
  stats: [
    { value: "2026", label: "Năm thành lập" },
    { value: "100%", label: "Dược liệu Việt" },
    { value: "90 ngày", label: "Lên men chuẩn" },
  ],
  contact: { phone: "0948 579 759", email: "info@duoclieuhk.vn", address: "TP Cần Thơ, Việt Nam" },
  footer: {
    about:
      "Dược liệu lên men theo công thức cổ truyền kết hợp công nghệ hiện đại — mang lại sự cân bằng cho cơ thể mỗi ngày.",
    copyright: "HKGROUP. Bảo lưu mọi quyền.",
    facebook: "", youtube: "", zalo: "",
  },
  faq: [],
};

// Invest trả settings dạng flat map key→string (contact_hotline, brand_since, ...).
type InvestSettings = Record<string, string>;

async function fetchInvestSettings(): Promise<InvestSettings> {
  try {
    const res = await fetch(`${INVEST_SERVER_URL}/api/v1/settings`, { next: { revalidate: 30 } });
    if (!res.ok) return {};
    return (await res.json()) as InvestSettings;
  } catch {
    return {};
  }
}

export async function getSettings(): Promise<SiteSettings> {
  const inv = await fetchInvestSettings();
  const since = inv.brand_since?.trim() || "2026";

  // clone default rồi ghi đè bằng config từ admin invest
  const s: SiteSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  const pick = (v?: string) => (v && v.trim() ? v.trim() : undefined);

  // Thương hiệu — logo có thể là URL tuyệt đối hoặc path tương đối /api/v1/public/images/...
  s.brand.name = pick(inv.brand_name) ?? s.brand.name;
  const logo = pick(inv.brand_logo_url);
  if (logo) s.brand.logoUrl = /^https?:\/\//i.test(logo) ? logo : `${INVEST_PUBLIC_URL}${logo.startsWith("/") ? "" : "/"}${logo}`;
  s.brand.tagline = pick(inv.brand_tagline) ?? `Since ${since}`;
  s.hero.eyebrow = `${s.brand.name} · Since ${since}`;
  if (s.stats[0]) s.stats[0].value = since;
  const heroSub = pick(inv.hero_subtitle);
  if (heroSub) s.hero.subtitle = heroSub;

  // SEO
  s.seo.title = pick(inv.seo_title) ?? s.seo.title;
  s.seo.description = pick(inv.seo_description) ?? s.seo.description;
  s.seo.keywords = pick(inv.seo_keywords) ?? s.seo.keywords;

  // Liên hệ
  s.contact.phone = pick(inv.contact_hotline) ?? s.contact.phone;
  s.contact.email = pick(inv.contact_email) ?? s.contact.email;
  s.contact.address = pick(inv.contact_address) ?? s.contact.address;

  // Footer + mạng xã hội
  s.footer.about = pick(inv.footer_about) ?? s.footer.about;
  s.footer.facebook = pick(inv.social_facebook) ?? s.footer.facebook;
  s.footer.youtube = pick(inv.social_youtube) ?? s.footer.youtube;
  s.footer.zalo = pick(inv.social_zalo) ?? s.footer.zalo;

  return s;
}
