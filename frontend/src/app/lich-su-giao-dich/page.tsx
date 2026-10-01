"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  useAuth,
  investMyOrders,
  investMyWithdrawals,
  investGet,
  type MyOrder,
  type MyWithdrawal,
  type SalesCommission,
} from "@/lib/invest-auth";
import { formatVND } from "@/lib/format";
import { AccountTabs } from "@/components/AccountTabs";
import { StatCard } from "@/components/StatCard";

type TxKind = "purchase" | "commission" | "withdrawal";
type Tx = {
  id: string;
  date: number; // epoch ms để sort
  kind: TxKind;
  label: string;
  sub: string;
  amount: number;
  direction: "in" | "out";
  status: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Chờ xử lý", cls: "bg-amber-100 text-amber-700" },
  paid: { label: "Đã thanh toán", cls: "bg-green-100 text-green-700" },
  approved: { label: "Đã duyệt", cls: "bg-blue-100 text-blue-700" },
  rejected: { label: "Từ chối", cls: "bg-red-100 text-red-600" },
  cancelled: { label: "Đã huỷ", cls: "bg-red-100 text-red-600" },
};

// Icon line-art (stroke currentColor) — đồng bộ phong cách với Navbar, không dùng emoji.
function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
function BagIcon() {
  return (
    <IconBase>
      <path d="M6 2 3 6v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </IconBase>
  );
}
function CoinsIcon() {
  return (
    <IconBase>
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </IconBase>
  );
}
function BankIcon() {
  return (
    <IconBase>
      <path d="M12 2 21 7H3z" />
      <path d="M6 10v8M10 10v8M14 10v8M18 10v8" />
      <path d="M3 21h18" />
    </IconBase>
  );
}

const KIND_META: Record<TxKind, { label: string; Icon: () => React.ReactElement; tint: string }> = {
  purchase: { label: "Mua hàng", Icon: BagIcon, tint: "bg-forest-50 text-forest-700" },
  commission: { label: "Hoa hồng", Icon: CoinsIcon, tint: "bg-gold-50 text-gold-700" },
  withdrawal: { label: "Rút tiền", Icon: BankIcon, tint: "bg-cream-100 text-ink/70" },
};

function ms(iso?: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}
function fmtTime(epoch: number): string {
  if (!epoch) return "";
  return new Date(epoch).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}
// Gom giao dịch theo NGÀY: cùng ngày → cùng nhóm. Key ổn định để Map giữ thứ tự (danh sách đã sort desc).
function dayKey(epoch: number): string {
  if (!epoch) return "unknown";
  const d = new Date(epoch);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dayLabel(epoch: number): string {
  if (!epoch) return "Không rõ ngày";
  const d = new Date(epoch);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(new Date()) - startOf(d)) / 86_400_000);
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Hôm qua";
  return d.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function TransactionsPage() {
  const { user, ready } = useAuth();
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [commissions, setCommissions] = useState<SalesCommission[] | null>(null);
  const [withdrawals, setWithdrawals] = useState<MyWithdrawal[] | null>(null);
  const [filter, setFilter] = useState<"all" | TxKind>("all");

  useEffect(() => {
    if (!user) return;
    investMyOrders().then((o) => setOrders(o ?? []));
    // Hoa hồng & rút tiền chỉ có với CTV; khách thường trả [] (hoặc null → coi như rỗng).
    investGet<SalesCommission[]>("/api/v1/sales/my-commissions").then((c) => setCommissions(c ?? []));
    investMyWithdrawals().then((w) => setWithdrawals(w ?? []));
  }, [user]);

  const txs = useMemo<Tx[]>(() => {
    const out: Tx[] = [];
    (orders ?? []).forEach((o) => {
      const names = o.items.map((i) => `${i.name} ×${i.qty}`).join(", ");
      out.push({
        id: `o-${o.code}`, date: ms(o.created_at), kind: "purchase",
        label: `Đơn ${o.code}`, sub: names, amount: o.subtotal_vnd, direction: "out", status: o.status,
      });
    });
    (commissions ?? []).forEach((c) => {
      out.push({
        id: `c-${c.id}`, date: ms(c.created_at), kind: "commission",
        label: c.kind === "affiliate" ? "Hoa hồng giới thiệu" : "Hoa hồng bán hàng",
        sub: `Doanh số ${formatVND(c.base_amount)} · ${(c.rate * 100).toFixed(1)}%`,
        amount: c.net_amount, direction: "in", status: c.status,
      });
    });
    (withdrawals ?? []).forEach((w) => {
      out.push({
        id: `w-${w.id}`, date: ms(w.requested_at), kind: "withdrawal",
        label: "Rút hoa hồng", sub: w.note || "Yêu cầu thanh toán", amount: w.amount, direction: "out", status: w.status,
      });
    });
    return out.sort((a, b) => b.date - a.date);
  }, [orders, commissions, withdrawals]);

  // Tổng quan hiển thị trên đầu trang: đã chi tiêu (mua hàng) và hoa hồng đã nhận.
  const summary = useMemo(() => {
    let spent = 0;
    let earned = 0;
    for (const t of txs) {
      if (t.kind === "purchase") spent += t.amount;
      else if (t.kind === "commission") earned += t.amount;
    }
    return { spent, earned, count: txs.length };
  }, [txs]);

  const loading = orders === null || commissions === null || withdrawals === null;
  const shown = filter === "all" ? txs : txs.filter((t) => t.kind === filter);
  const kinds = useMemo(() => new Set(txs.map((t) => t.kind)), [txs]);

  if (!user) {
    return (
      <div className="container-hk max-w-md py-20 text-center">
        {ready ? (
          <div className="card p-8">
            <h1 className="font-serif text-2xl font-bold text-forest-900">Lịch sử giao dịch</h1>
            <p className="mt-2 text-sm text-ink/55">Vui lòng đăng nhập để xem lịch sử giao dịch của bạn.</p>
            <Link href="/affiliate" className="btn btn-gold mt-5 inline-flex px-6 py-2.5 text-sm">Đăng nhập</Link>
          </div>
        ) : (
          <p className="text-sm text-ink/40">Đang tải…</p>
        )}
      </div>
    );
  }

  const filters: { key: "all" | TxKind; label: string }[] = [
    { key: "all", label: "Tất cả" },
    { key: "purchase", label: "Mua hàng" },
    ...(kinds.has("commission") ? [{ key: "commission" as const, label: "Hoa hồng" }] : []),
    ...(kinds.has("withdrawal") ? [{ key: "withdrawal" as const, label: "Rút tiền" }] : []),
  ];

  // Gom danh sách đang hiển thị theo ngày (giữ thứ tự mới→cũ vì `shown` đã sort desc).
  const groups: [string, Tx[]][] = [];
  {
    const idx = new Map<string, Tx[]>();
    for (const t of shown) {
      const k = dayKey(t.date);
      let bucket = idx.get(k);
      if (!bucket) {
        bucket = [];
        idx.set(k, bucket);
        groups.push([k, bucket]);
      }
      bucket.push(t);
    }
  }

  const hasCommission = kinds.has("commission");

  return (
    <div className="container-hk max-w-3xl py-12 sm:py-16">
      <AccountTabs active="tx" />

      <div className="mt-6">
        <p className="eyebrow">Tài khoản</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-forest-900">Lịch sử giao dịch</h1>
        <p className="mt-1.5 text-sm text-ink/50">Toàn bộ đơn hàng, hoa hồng và yêu cầu rút tiền của bạn.</p>
      </div>

      {/* Tổng quan */}
      {!loading && txs.length > 0 && (
        <div className={`mt-6 grid gap-3 ${hasCommission ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
          <StatCard label="Đã chi tiêu" value={formatVND(summary.spent)} tone="forest" hint="Tổng giá trị đơn hàng" />
          {hasCommission && (
            <StatCard label="Hoa hồng nhận" value={formatVND(summary.earned)} tone="gold" hint="Cộng dồn hoa hồng" />
          )}
          <StatCard label="Giao dịch" value={String(summary.count)} hint="Tổng số bản ghi" />
        </div>
      )}

      {filters.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key ? "bg-forest-800 text-gold-300" : "border border-cream-200 text-ink/55 hover:text-forest-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="mt-6 space-y-3" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card flex items-center gap-4 p-4">
              <span className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-cream-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-40 animate-pulse rounded bg-cream-100" />
                <div className="h-3 w-24 animate-pulse rounded bg-cream-100" />
              </div>
              <div className="h-4 w-20 animate-pulse rounded bg-cream-100" />
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-forest-50 text-forest-700"><BagIcon /></span>
          <p className="text-sm text-ink/55">Chưa có giao dịch nào.</p>
          <Link href="/san-pham" className="btn btn-gold px-6 py-2.5 text-sm">Mua sắm ngay</Link>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {groups.map(([key, items]) => (
            <section key={key}>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink/40">
                {dayLabel(items[0]?.date ?? 0)}
              </h2>
              <ul className="card divide-y divide-cream-200/70 overflow-hidden">
                {items.map((t) => {
                  const meta = KIND_META[t.kind];
                  const st = STATUS[t.status] ?? { label: t.status, cls: "bg-cream-200 text-ink/60" };
                  return (
                    <li key={t.id} className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-cream-50 sm:gap-4 sm:px-5">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${meta.tint}`}><meta.Icon /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate font-medium text-forest-900">{t.label}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                        </div>
                        {t.sub && <p className="mt-0.5 truncate text-xs text-ink/50">{t.sub}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`num font-semibold ${t.direction === "in" ? "text-green-700" : "text-forest-800"}`}>
                          {t.direction === "in" ? "+" : "−"}
                          {formatVND(t.amount)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink/40">{fmtTime(t.date)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
