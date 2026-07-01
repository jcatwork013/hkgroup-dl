import type { JsonLd } from "@/lib/seo";

// Nhúng JSON-LD an toàn (server component).
export function JsonLdScript({ data }: { data: JsonLd | JsonLd[] }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
