"use client";

import { useState } from "react";
import { useAuth } from "@/lib/invest-auth";

// Nút "Chia sẻ affiliate" — chỉ hiện với tài khoản bán hàng (saler/admin). Copy LINK ĐĂNG KÝ kèm
// ?ref=<mã giới thiệu>: người nhận mở link → khung đăng ký hiện sẵn mã → đăng ký xong bị khoá về
// CTV này → mọi đơn sau của họ đổ hoa hồng về đúng người chia sẻ ("ăn ref").
export function ShareAffiliate({ compact = false }: { slug?: string; compact?: boolean }) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!user || (user.role !== "saler" && user.role !== "admin") || !user.referral_code) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://duoclieuhk.vn";
  // Link ĐĂNG KÝ (không phải link sản phẩm) — mở thẳng khung đăng ký có mã giới thiệu.
  const url = `${origin}/affiliate?ref=${user.referral_code}`;

  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Sao chép link affiliate:", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      onClick={copy}
      className={
        compact
          ? "inline-flex items-center gap-1 text-xs font-medium text-forest-600 hover:text-gold-600"
          : "inline-flex items-center gap-2 rounded-full border border-forest-300 px-4 py-2 text-sm font-medium text-forest-700 transition-colors hover:bg-forest-50"
      }
      title={`Chia sẻ (mã ${user.referral_code})`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
      </svg>
      {copied ? "Đã copy link ✓" : "Chia sẻ affiliate"}
    </button>
  );
}
