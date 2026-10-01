import Link from "next/link";
import { Reveal } from "./Reveal";

export function SectionHeading({
  eyebrow,
  title,
  desc,
  center,
  dark,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  center?: boolean;
  dark?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow ? <p className={`eyebrow ${dark ? "!text-gold-300" : ""}`}>{eyebrow}</p> : null}
      <h2
        className={`mt-3 font-serif text-[1.85rem] font-semibold leading-tight sm:text-4xl md:text-[2.6rem] ${
          dark ? "text-cream-50" : "text-forest-900"
        }`}
      >
        {title}
      </h2>
      {desc ? (
        <p className={`mt-4 text-[15px] leading-relaxed sm:text-base ${dark ? "text-cream-100/60" : "text-ink/55"}`}>{desc}</p>
      ) : null}
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
    <section className="border-y border-cream-200 bg-white py-20 sm:py-28">
      <div className="container-hk">
        <Reveal>
          <SectionHeading eyebrow="Quy trình" title="Hành trình lên men 90 ngày" desc="Bốn bước khắt khe biến dược liệu thô thành tinh hoa dễ hấp thu." />
        </Reveal>
        <ol className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {/* đường nối các bước (desktop) */}
          <span className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-gold-300/0 via-gold-300 to-gold-300/0 lg:block" aria-hidden />
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 90}>
              <li className="relative">
                <span className="num relative flex h-12 w-12 items-center justify-center rounded-full bg-white font-serif text-lg font-semibold text-gold-600 ring-1 ring-gold-300">
                  {s.n}
                </span>
                <h3 className="mt-6 font-serif text-xl font-semibold text-forest-900">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/55">{s.d}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

// Lý do chọn — chỉ nêu những cam kết có thật trên trang sản phẩm / chính sách (chính hãng,
// truy xuất theo lô, đổi trả 7 ngày, giao 1–3 ngày). Không dùng thuật ngữ nội bộ.
const reasons: { t: string; d: string; icon: React.ReactNode }[] = [
  {
    t: "Lên men chuẩn hoá",
    d: "Công nghệ hiện đại kiểm soát từng mẻ để giữ trọn hoạt chất.",
    icon: <path d="M9 3h6M10 3v6.5L4.6 18.2A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-2.8L14 9.5V3M7.5 15h9" />,
  },
  {
    t: "Nguồn dược liệu Việt",
    d: "Tuyển chọn vùng trồng đạt chuẩn, nguồn gốc rõ ràng.",
    icon: <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10ZM2 21c0-3 1.9-5.4 5.1-6" />,
  },
  {
    t: "Chính hãng, truy xuất theo lô",
    d: "Mỗi sản phẩm có tem nhãn đầy đủ, tra cứu được lô sản xuất.",
    icon: <path d="M12 3l7 3v5c0 4.5-3 8.2-7 9.5C8 19.2 5 15.5 5 11V6l7-3zM9 12l2 2 4-4" />,
  },
  {
    t: "Giao nhanh, đổi trả 7 ngày",
    d: "Giao toàn quốc 1–3 ngày, kiểm tra hàng trước khi nhận.",
    icon: <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />,
  },
];

export function WhyUs() {
  return (
    <section className="hero-bg py-20 sm:py-28">
      <div className="container-hk">
        <Reveal>
          <SectionHeading eyebrow="Vì sao chọn HKGROUP" title="Cam kết của chúng tôi" center dark />
        </Reveal>
        <div className="mt-14 grid gap-px overflow-hidden rounded-3xl bg-cream-100/10 ring-1 ring-cream-100/10 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((r, i) => (
            <Reveal key={r.t} delay={i * 90} className="h-full">
              <div className="h-full bg-forest-950/40 p-7 transition-colors hover:bg-forest-950/20 sm:p-8">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-400/10 text-gold-300 ring-1 ring-gold-400/20">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {r.icon}
                  </svg>
                </span>
                <h3 className="mt-6 font-serif text-lg font-semibold text-cream-50">{r.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cream-100/55">{r.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// FAQ dùng <details> — hiển thị nội dung cho SEO, hoạt động không cần JS.
export function FAQ({ faqs }: { faqs: { q: string; a: string }[] }) {
  if (faqs.length === 0) return null;
  return (
    <section className="py-20 sm:py-28">
      <div className="container-hk grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <Reveal>
          <SectionHeading eyebrow="Hỏi đáp" title="Câu hỏi thường gặp" desc="Chưa thấy câu trả lời bạn cần? Gọi hotline để được tư vấn trực tiếp." />
        </Reveal>
        <div className="divide-y divide-cream-200 border-y border-cream-200">
          {faqs.map((f, i) => (
            <details key={i} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[15px] font-semibold text-forest-900 marker:hidden">
                {f.q}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ring-cream-200 transition-transform group-open:rotate-45" aria-hidden>
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="pb-5 pr-12 text-sm leading-relaxed text-ink/60">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaBand({ phone }: { phone: string }) {
  return (
    <section className="container-hk py-16 sm:py-20">
      <Reveal className="hero-bg overflow-hidden rounded-[2rem] px-7 py-12 sm:px-14 sm:py-16">
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-xl">
            <p className="eyebrow !text-gold-300">Affiliate</p>
            <h2 className="mt-3 font-serif text-[1.85rem] font-semibold leading-tight text-cream-50 sm:text-4xl">
              Cùng HKGROUP lan toả <span className="italic text-gold-300">sức khoẻ Việt</span>
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-cream-100/65">
              Giới thiệu sản phẩm và nhận hoa hồng minh bạch trên từng đơn hoàn tất.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/affiliate" className="btn btn-gold px-8 text-sm">Đăng ký Affiliate</Link>
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="btn btn-outline-cream num px-8 text-sm">
              Gọi {phone}
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
