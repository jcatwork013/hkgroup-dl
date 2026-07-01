// duoclieuhk.vn CHỈ là frontend. Toàn bộ dữ liệu (sản phẩm, settings, đăng nhập, ảnh)
// lấy từ MỘT API duy nhất: api.duoclieuhk.vn (backend + admin nằm ở hệ thống invest).

// Invest API công khai. Dùng cho:
//  • URL ảnh tương đối (/api/v1/public/images/...) → cần base công khai để trình duyệt tải.
const INVEST_PUBLIC_URL = process.env.NEXT_PUBLIC_INVEST_API_URL ?? "http://localhost:8080";
// Server-side (RSC/sitemap) fetch qua URL NỘI BỘ docker để tránh vòng ra ngoài rồi quay lại.
const INVEST_SERVER_URL = process.env.INVEST_INTERNAL_API_URL ?? INVEST_PUBLIC_URL;

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

export type ProductDetail = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  short_desc: string;
  description: string;
  price_vnd: number;
  badge: string;
  meta_title: string;
  meta_description: string;
  images?: string[];
  specs: { warranty: string; trace: string; delivery: string; return: string };
};

// Shape trả về từ invest public API (GET /api/v1/products, /products/{slug}).
type InvestProduct = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  badge: string;
  price_vnd: number;
  image_url: string;
  summary: string;
  description: string;
  spec_warranty: string;
  spec_trace: string;
  spec_delivery: string;
  spec_return: string;
};

// image_url có thể là URL tuyệt đối (CDN) hoặc path tương đối /api/v1/public/images/...
function imageURL(u?: string): string | undefined {
  if (!u) return undefined;
  if (/^https?:\/\//i.test(u)) return u; // đã tuyệt đối (CDN) → giữ nguyên
  return `${INVEST_PUBLIC_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

function toListItem(p: InvestProduct): ProductListItem {
  const img = imageURL(p.image_url);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    short_desc: p.summary,
    min_price_vnd: p.price_vnd,
    meta_title: p.name,
    meta_description: p.summary,
    images: img ? [img] : [],
  };
}

function toDetail(p: InvestProduct): ProductDetail {
  const img = imageURL(p.image_url);
  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    name: p.name,
    short_desc: p.summary,
    description: p.description,
    price_vnd: p.price_vnd,
    badge: p.badge,
    meta_title: p.name,
    meta_description: p.summary,
    images: img ? [img] : [],
    specs: {
      warranty: p.spec_warranty,
      trace: p.spec_trace,
      delivery: p.spec_delivery,
      return: p.spec_return,
    },
  };
}

// Server-side fetch với ISR (revalidate) — tốt cho SEO.
export async function getProducts(): Promise<ProductListItem[]> {
  try {
    const res = await fetch(`${INVEST_SERVER_URL}/api/v1/products`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { products: InvestProduct[] };
    return (data.products ?? []).map(toListItem);
  } catch {
    return []; // FE vẫn render khi invest backend chưa chạy (graceful)
  }
}

export async function getProduct(slug: string): Promise<ProductDetail | null> {
  try {
    const res = await fetch(`${INVEST_SERVER_URL}/api/v1/products/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return toDetail((await res.json()) as InvestProduct);
  } catch {
    return null;
  }
}
