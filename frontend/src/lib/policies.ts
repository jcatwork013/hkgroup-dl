// Chính sách web bán hàng — NGUỒN: admin CMS (invest) qua /api/v1/policies.
// Có fallback tĩnh để trang vẫn render khi API chưa sẵn sàng.
const INVEST_PUBLIC_URL = process.env.NEXT_PUBLIC_INVEST_API_URL ?? "http://localhost:8080";
const INVEST_SERVER_URL = process.env.INVEST_INTERNAL_API_URL ?? INVEST_PUBLIC_URL;

export type Policy = { slug: string; title: string; summary: string; body: string };

// Link tĩnh cho footer & sitemap (cấu trúc ổn định, không cần gọi API).
export const POLICY_LINKS: { slug: string; title: string }[] = [
  { slug: "bao-mat", title: "Chính sách bảo mật" },
  { slug: "doi-tra", title: "Chính sách đổi trả & hoàn tiền" },
  { slug: "van-chuyen", title: "Chính sách vận chuyển & giao hàng" },
  { slug: "thanh-toan", title: "Chính sách thanh toán" },
  { slug: "dieu-khoan", title: "Điều khoản sử dụng" },
];

const FALLBACK: Policy[] = POLICY_LINKS.map((p) => ({
  ...p,
  summary: "",
  body: "Nội dung đang được cập nhật. Vui lòng liên hệ hotline để được hỗ trợ.",
}));

export async function getPolicies(): Promise<Policy[]> {
  try {
    const res = await fetch(`${INVEST_SERVER_URL}/api/v1/policies`, { next: { revalidate: 60 } });
    if (!res.ok) return FALLBACK;
    const data = (await res.json()) as { policies?: Policy[] };
    return data.policies && data.policies.length ? data.policies : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export async function getPolicy(slug: string): Promise<Policy | null> {
  try {
    const res = await fetch(`${INVEST_SERVER_URL}/api/v1/policies/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return FALLBACK.find((p) => p.slug === slug) ?? null;
    return (await res.json()) as Policy;
  } catch {
    return FALLBACK.find((p) => p.slug === slug) ?? null;
  }
}
