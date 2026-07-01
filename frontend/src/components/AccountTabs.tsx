import Link from "next/link";

// Điều hướng chung giữa các trang tài khoản: Tài khoản · Thông tin cá nhân · Lịch sử giao dịch.
export function AccountTabs({ active }: { active: "account" | "profile" | "tx" }) {
  const tabs = [
    { key: "account", href: "/affiliate", label: "Tài khoản" },
    { key: "profile", href: "/thong-tin-ca-nhan", label: "Thông tin cá nhân" },
    { key: "tx", href: "/lich-su-giao-dich", label: "Lịch sử giao dịch" },
  ] as const;
  return (
    // 1 hàng, TRƯỢT ngang trên mobile (không wrap/rớt hàng); ẩn thanh cuộn cho gọn.
    <nav className="flex gap-2 overflow-x-auto pb-1 text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 font-medium transition-colors ${
            active === t.key
              ? "bg-forest-800 text-gold-300"
              : "border border-cream-200 text-ink/60 hover:text-forest-700"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
