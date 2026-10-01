import type { Metadata } from "next";
import { ProductCard } from "@/components/ProductCard";
import { JsonLdScript } from "@/components/JsonLd";
import { getProducts } from "@/lib/api";
import { itemListJsonLd } from "@/lib/seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const metadata: Metadata = {
  title: "Sản phẩm dược liệu lên men",
  description: "Danh mục dược liệu lên men HKGROUP — chuẩn hoá, truy xuất nguồn gốc rõ ràng.",
  alternates: { canonical: "/san-pham" },
};

export default async function ProductsPage() {
  const products = await getProducts();
  return (
    <div className="container-hk py-12 sm:py-16">
      <JsonLdScript
        data={[
          itemListJsonLd(products.map((p) => ({ name: p.name, slug: p.slug }))),
        ]}
      />
      <Breadcrumbs
        items={[
          { name: "Trang chủ", href: "/" },
          { name: "Sản phẩm", href: "/san-pham" },
        ]}
      />
      <header className="mb-10">
        <p className="eyebrow">Danh mục</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-forest-900 sm:text-4xl">Sản phẩm</h1>
        <p className="mt-3 max-w-2xl text-ink/60">
          Mỗi sản phẩm là kết tinh của dược liệu Việt và công nghệ lên men hiện đại.
        </p>
      </header>
      {products.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <div className="card p-10 text-center text-ink/50">Chưa có sản phẩm nào.</div>
      )}
    </div>
  );
}
