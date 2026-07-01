// Client gọi HKGROUP API. NEXT_PUBLIC_* bị bake vào bundle trình duyệt (gọi public URL).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8090";

// Server-side (RSC/sitemap) fetch qua URL NỘI BỘ trong docker network để tránh hairpin
// ra Cloudflare rồi vòng lại (server trong container thường không đi được đường đó).
// INTERNAL_API_URL là env runtime (không phải NEXT_PUBLIC) -> chỉ server đọc được.
const SERVER_API_URL = process.env.INTERNAL_API_URL ?? API_URL;

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  short_desc: string;
  min_price_vnd: number;
  meta_title: string;
  meta_description: string;
  images?: string[];
};

export type ProductVariant = {
  id: string;
  sku: string;
  name: string;
  price_vnd: number;
};

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  short_desc: string;
  description: string;
  meta_title: string;
  meta_description: string;
  variants: ProductVariant[];
  images?: string[];
};

// Server-side fetch với ISR (revalidate) — tốt cho SEO.
export async function getProducts(): Promise<ProductListItem[]> {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/products`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { products: ProductListItem[] };
    return data.products ?? [];
  } catch {
    return []; // FE vẫn render khi backend chưa chạy (graceful)
  }
}

export async function getProduct(slug: string): Promise<ProductDetail | null> {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/products/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as ProductDetail;
  } catch {
    return null;
  }
}

export { API_URL };
