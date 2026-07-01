// Cấu hình site do Admin CMS điều khiển. Đọc server-side (URL nội bộ) với default fallback.
import { API_URL } from "./api";

const SERVER_API_URL = process.env.INTERNAL_API_URL ?? API_URL;

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
  brand: { name: "HKGROUP", logoUrl: "", tagline: "Since 2019" },
  hero: {
    eyebrow: "HKGROUP · Since 2019",
    titleLead: "Dược liệu lên men,",
    titleAccent: "tinh hoa",
    titleRest: "từ thiên nhiên Việt",
    subtitle:
      "Công thức cổ truyền kết hợp công nghệ lên men hiện đại — mang lại sự cân bằng cho cơ thể mỗi ngày.",
    ctaPrimary: "Khám phá sản phẩm",
    ctaSecondary: "Trở thành Affiliate",
  },
  stats: [
    { value: "2019", label: "Năm thành lập" },
    { value: "100%", label: "Dược liệu Việt" },
    { value: "90 ngày", label: "Lên men chuẩn" },
  ],
  contact: { phone: "1900 0000", email: "hello@hkgroup.vn", address: "Hà Nội, Việt Nam" },
  footer: {
    about:
      "Dược liệu lên men theo công thức cổ truyền kết hợp công nghệ hiện đại — mang lại sự cân bằng cho cơ thể mỗi ngày.",
    copyright: "HKGROUP. Bảo lưu mọi quyền.",
    facebook: "", youtube: "", zalo: "",
  },
  faq: [],
};

function deepMerge<T>(base: T, over: unknown): T {
  if (over === null || over === undefined) return base;
  if (typeof base !== "object" || Array.isArray(base)) return (over as T) ?? base;
  const out = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    if (v === undefined) continue;
    const b = (base as Record<string, unknown>)[k];
    out[k] = b && typeof b === "object" && !Array.isArray(b) ? deepMerge(b, v) : v;
  }
  return out as T;
}

export async function getSettings(): Promise<SiteSettings> {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/settings`, { next: { revalidate: 30 } });
    if (!res.ok) return DEFAULT_SETTINGS;
    const data = await res.json();
    return deepMerge(DEFAULT_SETTINGS, data);
  } catch {
    return DEFAULT_SETTINGS;
  }
}
