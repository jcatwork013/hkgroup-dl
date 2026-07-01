import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/JsonLd";
import { getPolicy, getPolicies, POLICY_LINKS } from "@/lib/policies";
import { getSettings } from "@/lib/settings";
import { breadcrumbJsonLd } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return POLICY_LINKS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const policy = await getPolicy(slug);
  if (!policy) return { title: "Không tìm thấy trang", robots: { index: false } };
  return {
    title: policy.title,
    description: policy.summary,
    alternates: { canonical: `/chinh-sach/${policy.slug}` },
  };
}

export default async function PolicyPage({ params }: Props) {
  const { slug } = await params;
  const [policy, all, settings] = await Promise.all([getPolicy(slug), getPolicies(), getSettings()]);
  if (!policy) notFound();
  const { contact } = settings;
  const paragraphs = policy.body.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);

  return (
    <div className="container-hk py-12 sm:py-16">
      <JsonLdScript
        data={breadcrumbJsonLd([
          { name: "Trang chủ", url: "/" },
          { name: "Chính sách", url: "/chinh-sach" },
          { name: policy.title, url: `/chinh-sach/${policy.slug}` },
        ])}
      />

      <nav aria-label="breadcrumb" className="mb-4 text-sm text-ink/50">
        <Link href="/" className="hover:text-gold-600">Trang chủ</Link> <span className="px-1">/</span>
        <Link href="/chinh-sach" className="hover:text-gold-600"> Chính sách</Link> <span className="px-1">/</span>
        <span className="text-ink/70"> {policy.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow">Chính sách</p>
          <ul className="mt-3 space-y-1 text-sm">
            {all.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/chinh-sach/${p.slug}`}
                  className={`block rounded-lg px-3 py-2 ${
                    p.slug === policy.slug ? "bg-forest-50 font-medium text-forest-800" : "text-ink/60 hover:bg-cream-100 hover:text-forest-700"
                  }`}
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <article className="max-w-3xl">
          <h1 className="font-serif text-3xl font-bold text-forest-900 sm:text-4xl">{policy.title}</h1>
          {policy.summary && <p className="mt-2 text-ink/60">{policy.summary}</p>}
          <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-ink/70">
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line">{p}</p>
            ))}
          </div>

          <div className="mt-10 card p-6">
            <p className="text-sm font-semibold text-forest-900">Cần hỗ trợ thêm?</p>
            <p className="mt-1 text-sm text-ink/60">
              Hotline{" "}
              <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="font-medium text-forest-700 hover:text-gold-600">{contact.phone}</a>{" "}
              · Email{" "}
              <a href={`mailto:${contact.email}`} className="font-medium text-forest-700 hover:text-gold-600">{contact.email}</a>
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}
