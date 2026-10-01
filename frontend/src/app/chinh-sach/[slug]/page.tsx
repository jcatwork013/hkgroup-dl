import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getPolicy, getPolicies, getPolicyLinks, shortPolicyLabel } from "@/lib/policies";
import { getSettings } from "@/lib/settings";

type Props = { params: Promise<{ slug: string }> };

// Markup nhẹ cho nội dung chính sách: "## " = tiêu đề mục, "### " = tiêu đề phụ,
// dòng bắt đầu bằng • - * = gạch đầu dòng, còn lại là đoạn văn. Tương thích ngược
// với nội dung cũ (đoạn cách nhau 1 dòng trống).
type PolicyBlock =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "p"; text: string };

function parsePolicyBody(body: string): PolicyBlock[] {
  const blocks: PolicyBlock[] = [];
  let para: string[] = [];
  let bullets: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join("\n") });
    para = [];
  };
  const flushBullets = () => {
    if (bullets.length) blocks.push({ kind: "ul", items: bullets });
    bullets = [];
  };
  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) { flushBullets(); flushPara(); continue; }
    const h3 = /^###\s+(.*)/.exec(line);
    const h2 = /^##\s+(.*)/.exec(line);
    const bullet = /^[•\-*]\s+(.*)/.exec(line);
    if (h3) { flushBullets(); flushPara(); blocks.push({ kind: "h3", text: h3[1] ?? "" }); continue; }
    if (h2) { flushBullets(); flushPara(); blocks.push({ kind: "h2", text: h2[1] ?? "" }); continue; }
    if (bullet) { flushPara(); bullets.push(bullet[1] ?? ""); continue; }
    flushBullets(); para.push(line);
  }
  flushBullets(); flushPara();
  return blocks;
}

// Prerender theo danh sách CMS (không cứng 5 slug) — slug lạ vẫn render on-demand như trước.
export async function generateStaticParams() {
  return (await getPolicyLinks()).map((p) => ({ slug: p.slug }));
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
  const blocks = parsePolicyBody(policy.body);

  return (
    <div className="container-hk py-12 sm:py-16">
      <Breadcrumbs
        items={[
          { name: "Trang chủ", href: "/" },
          { name: "Chính sách", href: "/chinh-sach" },
          { name: policy.title, href: `/chinh-sach/${policy.slug}` },
        ]}
      />

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
                  {shortPolicyLabel(p.title)}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <article className="max-w-3xl">
          <h1 className="font-serif text-3xl font-bold text-forest-900 sm:text-4xl">{policy.title}</h1>
          {policy.summary && <p className="mt-2 text-ink/60">{policy.summary}</p>}
          <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-ink/75">
            {blocks.map((b, i) => {
              if (b.kind === "h2")
                return (
                  <h2 key={i} className="!mt-9 mb-1 font-serif text-xl font-semibold text-forest-900 first:!mt-0">
                    {b.text}
                  </h2>
                );
              if (b.kind === "h3")
                return (
                  <h3 key={i} className="!mt-6 mb-1 font-semibold text-forest-800">
                    {b.text}
                  </h3>
                );
              if (b.kind === "ul")
                return (
                  <ul key={i} className="space-y-2">
                    {b.items.map((it, j) => (
                      <li key={j} className="flex gap-2.5">
                        <span aria-hidden className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                );
              return <p key={i} className="whitespace-pre-line">{b.text}</p>;
            })}
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
