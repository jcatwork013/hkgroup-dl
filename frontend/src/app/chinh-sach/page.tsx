import type { Metadata } from "next";
import Link from "next/link";
import { JsonLdScript } from "@/components/JsonLd";
import { getPolicies } from "@/lib/policies";
import { breadcrumbJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Chính sách",
  description: "Tổng hợp chính sách bảo mật, đổi trả, vận chuyển, thanh toán và điều khoản sử dụng của HKGROUP.",
  alternates: { canonical: "/chinh-sach" },
};

export default async function PoliciesIndexPage() {
  const policies = await getPolicies();
  return (
    <div className="container-hk py-12 sm:py-16">
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: "Trang chủ", url: "/" },
          { name: "Chính sách", url: "/chinh-sach" },
        ])}
      />
      <nav aria-label="breadcrumb" className="mb-4 text-sm text-ink/50">
        <Link href="/" className="hover:text-gold-600">Trang chủ</Link> <span className="px-1">/</span> Chính sách
      </nav>
      <header className="mb-10">
        <p className="eyebrow">Điều khoản & chính sách</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-forest-900 sm:text-4xl">Chính sách</h1>
        <p className="mt-3 max-w-2xl text-ink/60">
          Minh bạch trong từng cam kết — quyền lợi khách hàng luôn được đặt lên hàng đầu.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {policies.map((p) => (
          <Link key={p.slug} href={`/chinh-sach/${p.slug}`} className="card group flex flex-col p-6 transition-shadow hover:shadow-lg">
            <h2 className="font-serif text-lg font-semibold text-forest-900 group-hover:text-forest-700">{p.title}</h2>
            <p className="mt-2 flex-1 text-sm text-ink/60">{p.summary}</p>
            <span className="mt-4 text-xs font-medium text-gold-600 group-hover:text-gold-500">Xem chi tiết →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
