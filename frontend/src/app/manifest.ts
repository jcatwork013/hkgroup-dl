import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";

// PWA manifest động: tên/mô tả/icon lấy từ CMS (admin sửa qua brand.logoUrl).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  const logo = s.brand.logoUrl;
  return {
    name: `${s.brand.name} — ${s.brand.tagline}`,
    short_name: s.brand.name || "HKGROUP",
    description: s.seo.description,
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f0",
    theme_color: "#143021",
    icons: logo ? [{ src: logo, sizes: "any", type: "image/jpeg" }] : [],
    lang: "vi",
  };
}
