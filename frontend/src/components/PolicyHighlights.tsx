import Link from "next/link";

// Dải 3 CAM KẾT / CHÍNH SÁCH ngay trên footer — hiện ở mọi trang. Mỗi ô dẫn tới trang chính sách
// đầy đủ (nội dung do admin soạn ở CMS, xem lib/policies.ts). Tiêu đề & mô tả ở đây là bản NGẮN
// cho khách đọc nhanh; sửa nội dung chi tiết thì sửa ở CMS, không cần sửa file này.
const HIGHLIGHTS: { slug: string; title: string; desc: string; icon: React.ReactNode }[] = [
  {
    slug: "van-chuyen",
    title: "Vận chuyển toàn quốc",
    desc: "Giao hàng 1–3 ngày, kiểm tra hàng trước khi nhận.",
    icon: (
      <>
        <path d="M10 17h4V5H2v12h3" /><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1" />
        <circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
      </>
    ),
  },
  {
    slug: "doi-tra",
    title: "Đổi trả & hoàn tiền",
    desc: "Hàng lỗi, sai mẫu hoặc thiếu số lượng được đổi trả theo chính sách.",
    icon: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
      </>
    ),
  },
  {
    slug: "bao-mat",
    title: "Bảo mật thông tin",
    desc: "Thông tin khách hàng được bảo vệ, không chia sẻ cho bên thứ ba.",
    icon: (
      <>
        <path d="M12 3l7 3v6c0 4.4-2.9 8.3-7 9.5C7.9 20.3 5 16.4 5 12V6l7-3z" /><path d="m9 12 2 2 4-4" />
      </>
    ),
  },
];

export function PolicyHighlights() {
  return (
    // Nền TRẮNG để nổi trên nền kem của body và tách khỏi footer xanh rêu bên dưới.
    <section aria-label="Chính sách mua hàng" className="mt-20 border-y border-cream-200 bg-white sm:mt-24">
      <div className="container-hk grid divide-cream-200 py-2 sm:grid-cols-3 sm:divide-x">
        {HIGHLIGHTS.map((h) => (
          <Link
            key={h.slug}
            href={`/chinh-sach/${h.slug}`}
            className="group flex items-start gap-4 px-1 py-6 transition-colors sm:px-6 sm:first:pl-1 sm:last:pr-1"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest-50 text-forest-700 transition-colors group-hover:bg-forest-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                {h.icon}
              </svg>
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-forest-900 group-hover:text-gold-700">{h.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink/55">{h.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
