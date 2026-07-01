import Link from "next/link";
import { Reveal } from "./Reveal";

export function SectionHeading({
  eyebrow,
  title,
  desc,
  center,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 className="mt-2 font-serif text-2xl font-bold text-forest-900 sm:text-3xl md:text-4xl">{title}</h2>
      {desc ? <p className="mt-3 text-[15px] leading-relaxed text-ink/60 sm:text-base">{desc}</p> : null}
    </div>
  );
}

const steps = [
  { n: "01", t: "Tuyển chọn dược liệu", d: "Vùng trồng đạt chuẩn, thu hái đúng thời điểm, kiểm định đầu vào." },
  { n: "02", t: "Lên men chuẩn hoá", d: "Chủng men chọn lọc, kiểm soát nhiệt độ – độ ẩm theo từng mẻ." },
  { n: "03", t: "Cô đặc & tinh chế", d: "Giữ trọn hoạt chất, tăng sinh khả dụng, loại tạp." },
  { n: "04", t: "Kiểm nghiệm & đóng gói", d: "Đạt chỉ tiêu an toàn, truy xuất nguồn gốc theo lô." },
];

export function Process() {
  return (
    <section className="container-hk py-16 sm:py-20">
      <Reveal>
        <SectionHeading eyebrow="Quy trình" title="Hành trình lên men 90 ngày" desc="Bốn bước khắt khe biến dược liệu thô thành tinh hoa dễ hấp thu." />
      </Reveal>
      <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 90}>
            <li className="card h-full p-6">
              <span className="font-serif text-3xl font-bold text-gold-500/80">{s.n}</span>
              <h3 className="mt-3 font-serif text-lg font-semibold text-forest-900">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/60">{s.d}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

const reasons = [
  { t: "Lên men chuẩn hoá", d: "Công nghệ hiện đại kiểm soát từng mẻ để giữ trọn hoạt chất." },
  { t: "Nguồn dược liệu Việt", d: "Tuyển chọn vùng trồng đạt chuẩn, truy xuất nguồn gốc minh bạch." },
  { t: "Minh bạch sổ kép", d: "Mọi dòng tiền hoa hồng & quỹ ghi nhận trên ledger, đối soát rõ ràng." },
  { t: "Giao nhanh theo khu vực", d: "Mạng hub nhượng quyền đảm bảo sản phẩm tươi mới đến tay bạn." },
];

export function WhyUs() {
  return (
    <section className="bg-cream-100/60 py-16 sm:py-20">
      <div className="container-hk">
        <Reveal>
          <SectionHeading eyebrow="Vì sao chọn HKGROUP" title="Cam kết của chúng tôi" center />
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((r, i) => (
            <Reveal key={r.t} delay={i * 90}>
              <div className="card h-full p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-forest-700">
                  <span className="font-serif text-xl text-gold-400">✦</span>
                </div>
                <h3 className="font-serif text-lg font-semibold text-forest-900">{r.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/60">{r.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const reviews = [
  { name: "Chị Lan", role: "Khách hàng Hà Nội", text: "Dùng cao linh chi lên men 2 tháng, ngủ ngon hơn hẳn. Đóng gói kỹ, có tem truy xuất." },
  { name: "Anh Dũng", role: "Affiliate", text: "Hoa hồng rõ ràng từng đơn, rút đúng lịch. Dashboard minh bạch nên rất yên tâm." },
  { name: "Cô Hoa", role: "Chủ hub Đà Nẵng", text: "Nhập hàng – tồn kho – giao đều gọn trên hệ thống. Khách khu vực nhận hàng nhanh." },
];

export function Testimonials() {
  return (
    <section className="container-hk py-16 sm:py-20">
      <Reveal>
        <SectionHeading eyebrow="Khách hàng nói gì" title="Niềm tin từ cộng đồng" center />
      </Reveal>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {reviews.map((r, i) => (
          <Reveal key={r.name} delay={i * 100}>
            <figure className="card flex h-full flex-col p-6">
              <div className="text-gold-500" aria-hidden>★★★★★</div>
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-ink/70">“{r.text}”</blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-semibold text-forest-900">{r.name}</span>
                <span className="text-ink/50"> · {r.role}</span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// FAQ dùng <details> — hiển thị nội dung cho SEO, hoạt động không cần JS.
export function FAQ({ faqs }: { faqs: { q: string; a: string }[] }) {
  if (faqs.length === 0) return null;
  return (
    <section className="bg-cream-100/60 py-16 sm:py-20">
      <div className="container-hk max-w-3xl">
        <Reveal>
          <SectionHeading eyebrow="Hỏi đáp" title="Câu hỏi thường gặp" center />
        </Reveal>
        <div className="mt-8 divide-y divide-cream-200 overflow-hidden rounded-xl border border-cream-200 bg-white">
          {faqs.map((f, i) => (
            <details key={i} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-medium text-forest-900 marker:hidden">
                {f.q}
                <span className="text-gold-600 transition-transform group-open:rotate-45" aria-hidden>＋</span>
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-ink/65">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaBand({ phone }: { phone: string }) {
  return (
    <section className="container-hk py-12 sm:py-16">
      <Reveal className="hero-bg overflow-hidden rounded-2xl px-6 py-12 text-center sm:px-16 sm:py-16">
        <h2 className="font-serif text-2xl font-bold text-cream-50 sm:text-4xl">
          Cùng HKGROUP lan toả <span className="italic text-gold-400">sức khoẻ Việt</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-cream-100/75 sm:text-base">
          Tham gia Affiliate 1 tầng — hoa hồng minh bạch trên từng đơn hoàn tất.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/affiliate" className="btn btn-gold px-8 py-3 text-sm">Đăng ký Affiliate</Link>
          <a href={`tel:${phone.replace(/\s/g, "")}`} className="btn btn-outline-cream px-8 py-3 text-sm">
            Gọi {phone}
          </a>
        </div>
      </Reveal>
    </section>
  );
}
