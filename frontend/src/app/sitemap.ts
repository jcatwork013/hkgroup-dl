import type { MetadataRoute } from "next";
import { getProducts, SITE_URL } from "@/lib/api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts();
  const productUrls: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/san-pham/${p.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const staticUrls: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/san-pham`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/ve-chung-toi`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/affiliate`, changeFrequency: "monthly", priority: 0.5 },
  ];

  return [...staticUrls, ...productUrls];
}
