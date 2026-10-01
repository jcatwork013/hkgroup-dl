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
  video_url?: string;
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
  video_url?: string;
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
  images?: string[];
  video_url?: string;
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

// Bộ sưu tập ảnh: ẢNH ĐẠI DIỆN (image_url, admin chọn) luôn đứng đầu, sau đó các ảnh còn
// lại theo thứ tự admin sắp. API cũ chưa có `images` → chỉ còn ảnh đại diện.
function gallery(p: InvestProduct): string[] {
  const out: string[] = [];
  for (const u of [p.image_url, ...(p.images ?? [])]) {
    const abs = imageURL(u);
    if (abs && !out.includes(abs)) out.push(abs);
  }
  return out;
}

function toListItem(p: InvestProduct): ProductListItem {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    short_desc: p.summary,
    min_price_vnd: p.price_vnd,
    meta_title: p.name,
    meta_description: p.summary,
    images: gallery(p),
    video_url: imageURL(p.video_url),
  };
}

function toDetail(p: InvestProduct): ProductDetail {
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
    images: gallery(p),
    video_url: imageURL(p.video_url),
    specs: {
      warranty: p.spec_warranty,
      trace: p.spec_trace,
      delivery: p.spec_delivery,
      return: p.spec_return,
    },
  };
}

// Sản phẩm KHÔNG cache: admin thêm/sửa ở admin.duoclieuhk.vn là lên web NGAY lần tải kế tiếp
// (trước đây ISR 60s + stale-while-revalidate khiến web hiện dữ liệu cũ khá lâu). Trang vẫn
// render phía server nên SEO không đổi; catalog nhỏ nên mỗi request gọi API là rẻ. Trong
// một lần render, Next tự gộp các fetch GET trùng URL (metadata + page) thành 1 lần gọi.
export async function getProducts(): Promise<ProductListItem[]> {
  try {
    const res = await fetch(`${INVEST_SERVER_URL}/api/v1/products`, { cache: "no-store" });
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
      cache: "no-store",
    });
    if (!res.ok) return null;
    return toDetail((await res.json()) as InvestProduct);
  } catch {
    return null;
  }
}
