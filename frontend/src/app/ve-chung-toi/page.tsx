import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Về chúng tôi",
  description: "Câu chuyện HKGROUP — dược liệu lên men theo công thức cổ truyền kết hợp công nghệ hiện đại.",
  alternates: { canonical: "/ve-chung-toi" },
};

export default async function AboutPage() {
  const s = await getSettings();
  return (
    <div className="container-hk max-w-3xl py-12 sm:py-16">
      <Breadcrumbs
        items={[
          { name: "Trang chủ", href: "/" },
          { name: "Về chúng tôi", href: "/ve-chung-toi" },
        ]}
      />
      <p className="eyebrow">{s.brand.tagline}</p>
      <h1 className="mt-1 font-serif text-3xl font-bold text-forest-900 sm:text-4xl">Về {s.brand.name}</h1>
      <div className="mt-6 space-y-4 leading-relaxed text-ink/70">
        <p>{s.footer.about}</p>
        <p>
          Chúng tôi vận hành minh bạch: mọi dòng tiền — từ doanh thu, hoa hồng affiliate đến quỹ
          đồng chia — đều được ghi nhận trên sổ kép, đối soát rõ ràng từng đồng.
        </p>
        <p>
          Mạng lưới hub nhượng quyền theo khu vực giúp sản phẩm đến tay khách hàng nhanh và tươi
          mới nhất, đồng thời tạo sinh kế cho đối tác địa phương.
        </p>
      </div>
      <div className="mt-8 card p-6">
        <h2 className="font-serif text-lg font-semibold text-forest-900">Liên hệ</h2>
        <ul className="mt-3 space-y-1 text-sm text-ink/70">
          <li>Hotline: {s.contact.phone}</li>
          <li>Email: {s.contact.email}</li>
          <li>Địa chỉ: {s.contact.address}</li>
        </ul>
      </div>
    </div>
  );
}
