import Link from "next/link";
import { BrandMark } from "./BrandMark";
import { getPolicyLinks, shortPolicyLabel } from "@/lib/policies";
import type { SiteSettings } from "@/lib/settings";

// contact_address ở CMS là MỘT chuỗi gộp: "CÔNG TY ... - MST : ... - Ngày cấp : ... - Địa chỉ : ...".
// Nhồi cả khối đó vào cột Liên hệ trông rất rối, nên tách: địa chỉ ở cột Liên hệ, phần pháp lý
// (tên công ty, MST, ngày/nơi cấp) xuống thanh cuối dạng một dòng nhỏ — chuẩn footer TMĐT.
function splitContactInfo(raw: string): { address: string; legal: string } {
  const parts = raw
    .split(/\s*-\s+/)
    .map((s) => s.trim().replace(/\s+:\s*/g, ": "))
    .filter(Boolean);
  if (parts.length < 2) return { address: raw.trim(), legal: "" };
  const i = parts.findIndex((p) => /^địa chỉ/i.test(p));
  const addrIdx = i >= 0 ? i : parts.length - 1;
  const addr = parts[addrIdx] ?? raw.trim();
  return {
    address: addr.replace(/^địa chỉ:?\s*/i, ""),
    legal: parts.filter((_, k) => k !== addrIdx).join(" · "),
  };
}

// Trang xác nhận "Đã thông báo" của website trên cổng Bộ Công Thương.
const BCT_NOTICE_URL = "https://online.gov.vn/nen-tang/434f8ce3-aa5d-4074-9d33-8f1af2399e5e";

// Icon mạng xã hội: nút tròn viền mảnh trên nền xanh rêu — gọn hơn danh sách chữ.
const SOCIAL_ICON: Record<string, React.ReactNode> = {
  Facebook: <path d="M14.5 8.5H16.5V5.6h-2.3c-2.5 0-3.7 1.5-3.7 3.6v1.6H8.5v3h2v7h3v-7h2.2l.4-3h-2.6V9.4c0-.6.2-.9 1-.9z" fill="currentColor" stroke="none" />,
  YouTube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10.5 9.6l5 2.4-5 2.4V9.6z" fill="currentColor" stroke="none" />
    </>
  ),
  Zalo: (
    <>
      <path d="M12 3.8c4.7 0 8.5 3.1 8.5 7s-3.8 7-8.5 7c-.9 0-1.7-.1-2.5-.3L5.5 20l.9-3a6.6 6.6 0 0 1-2.9-5.3c0-3.8 3.8-6.9 8.5-6.9z" />
      <path d="M8.8 10h2.6l-2.6 3.4h2.7M14.4 10v3.4M14.4 13.4h1.9" />
    </>
  ),
};

export async function Footer({ settings }: { settings: SiteSettings }) {
  const { brand, footer, contact } = settings;
  // Cột "Chính sách" liệt kê TẤT CẢ chính sách đang bật trong CMS (kể cả chính sách mới admin thêm),
  // không còn danh sách cứng — thiếu link chính sách là rủi ro tuân thủ TMĐT.
  const policyLinks = await getPolicyLinks();
  const social = [
    { href: footer.facebook, label: "Facebook" },
    { href: footer.youtube, label: "YouTube" },
    { href: footer.zalo, label: "Zalo" },
  ].filter((s) => s.href);
  const tel = contact.phone.replace(/\s/g, "");
  const { address, legal } = splitContactInfo(contact.address);

  return (
    // Khoảng cách trên do <PolicyHighlights> (dải 3 chính sách) ngay phía trên đảm nhiệm.
    <footer className="bg-forest-950 text-cream-100/65">
      <div className="container-hk grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
        {/* Thương hiệu */}
        <div className="sm:col-span-2 lg:col-span-4">
          <BrandMark brand={brand} size="lg" />
          <p className="mt-5 max-w-sm text-sm leading-relaxed">{footer.about}</p>
          {social.length > 0 && (
            <div className="mt-6 flex gap-2.5">
              {social.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-cream-100/15 text-cream-100/70 transition-colors hover:border-gold-400/60 hover:text-gold-400"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    {SOCIAL_ICON[s.label]}
                  </svg>
                </a>
              ))}
            </div>
          )}
        </div>

        <FooterCol title="Khám phá" className="lg:col-span-2">
          <FooterLink href="/san-pham">Sản phẩm</FooterLink>
          <FooterLink href="/affiliate">Tài khoản &amp; Affiliate</FooterLink>
          <FooterLink href="/ve-chung-toi">Về chúng tôi</FooterLink>
          <FooterLink href="/gio-hang">Giỏ hàng</FooterLink>
        </FooterCol>

        <FooterCol title="Chính sách" className="lg:col-span-3">
          {policyLinks.map((p) => (
            <FooterLink key={p.slug} href={`/chinh-sach/${p.slug}`} title={p.title}>
              {shortPolicyLabel(p.title)}
            </FooterLink>
          ))}
        </FooterCol>

        {/* Liên hệ — icon + nội dung, dễ quét mắt hơn danh sách chữ thuần */}
        <div className="lg:col-span-3">
          <h4 className="mb-3.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-cream-50/90">Liên hệ</h4>
          <ul className="space-y-3 text-sm">
            <ContactRow icon={<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />}>
              <a href={`tel:${tel}`} className="font-medium text-cream-50 transition-colors hover:text-gold-400">{contact.phone}</a>
            </ContactRow>
            <ContactRow
              icon={
                <>
                  <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                  <path d="m22 6-10 7L2 6" />
                </>
              }
            >
              <a href={`mailto:${contact.email}`} className="break-all transition-colors hover:text-gold-400">{contact.email}</a>
            </ContactRow>
            <ContactRow
              icon={
                <>
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
                  <circle cx="12" cy="10" r="3" />
                </>
              }
            >
              {address}
            </ContactRow>
          </ul>
        </div>
      </div>

      {/* Thanh cuối: pháp lý công ty + bản quyền bên trái, logo "Đã thông báo Bộ Công Thương" bên phải
          (bắt buộc với website TMĐT — link về trang xác nhận trên online.gov.vn). */}
      <div className="border-t border-cream-100/10">
        <div className="container-hk flex flex-col gap-4 py-5 text-xs leading-relaxed text-cream-100/40 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div className="space-y-1">
            {legal && <p>{legal}</p>}
            <p>© {new Date().getFullYear()} {footer.copyright}</p>
          </div>
          <a
            href={BCT_NOTICE_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Đã thông báo Bộ Công Thương"
            className="shrink-0 self-start sm:self-auto"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh nhỏ, không cần next/image */}
            <img src="/da-thong-bao-bct.png" alt="Đã thông báo Bộ Công Thương" width={512} height={194} loading="lazy" className="h-12 w-auto" />
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <h4 className="mb-3.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-cream-50/90">{title}</h4>
      <ul className="space-y-2 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ href, title, children }: { href: string; title?: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} title={title} className="line-clamp-2 transition-colors hover:text-gold-400">
        {children}
      </Link>
    </li>
  );
}

// Dòng liên hệ: icon line-art vàng đồng + nội dung (link gọi/mail hoặc text địa chỉ).
function ContactRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-gold-500/80">
        {icon}
      </svg>
      <span className="min-w-0">{children}</span>
    </li>
  );
}
