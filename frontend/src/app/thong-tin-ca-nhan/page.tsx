"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useAuth,
  investProfile,
  investSaveProfile,
  investMyReferrer,
  investMyReferredCustomers,
  ROLE_LABEL,
  type FullProfile,
  type ReferrerInfo,
  type ReferredCustomer,
} from "@/lib/invest-auth";
import { formatVND } from "@/lib/format";
import { AccountTabs } from "@/components/AccountTabs";

const EMPTY: FullProfile = {
  date_of_birth: "",
  gender: "",
  nationality: "Việt Nam",
  cccd_number: "",
  cccd_issue_date: "",
  cccd_issue_place: "",
  permanent_address: "",
  contact_address: "",
  occupation: "",
  tax_code: "",
  bank_name: "",
  bank_account_number: "",
  bank_account_name: "",
};

export default function ProfilePage() {
  const { user, ready } = useAuth();
  const [p, setP] = useState<FullProfile>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user) return;
    investProfile().then((raw) => {
      if (raw) {
        const r = raw as Record<string, unknown>;
        setP((prev) => {
          const next = { ...prev };
          (Object.keys(EMPTY) as (keyof FullProfile)[]).forEach((k) => {
            next[k] = (r[k] as string) || EMPTY[k];
          });
          return next;
        });
      }
      setLoaded(true);
    });
  }, [user]);

  const set = (k: keyof FullProfile, v: string) => setP((prev) => ({ ...prev, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    const ok = await investSaveProfile(p);
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } else {
      setErr("Không lưu được. Phiên đăng nhập có thể đã hết hạn — hãy đăng nhập lại.");
    }
  }

  if (!user) {
    return (
      <div className="container-hk max-w-md py-20 text-center">
        {ready ? (
          <div className="card p-8">
            <h1 className="font-serif text-2xl font-bold text-forest-900">Thông tin cá nhân</h1>
            <p className="mt-2 text-sm text-ink/55">Vui lòng đăng nhập để xem &amp; cập nhật hồ sơ của bạn.</p>
            <Link href="/affiliate" className="btn btn-gold mt-5 inline-flex px-6 py-2.5 text-sm">Đăng nhập</Link>
          </div>
        ) : (
          <p className="text-sm text-ink/40">Đang tải…</p>
        )}
      </div>
    );
  }

  return (
    <div className="container-hk max-w-3xl py-12 sm:py-16">
      <AccountTabs active="profile" />
      <h1 className="mt-6 font-serif text-3xl font-bold text-forest-900">Thông tin cá nhân</h1>

      {/* Định danh tài khoản — chỉ đọc (đổi qua hỗ trợ) */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ReadCard label="Họ và tên" value={user.full_name} />
        <ReadCard label="Vai trò" value={ROLE_LABEL[user.role] ?? user.role} />
        <ReadCard label="Email" value={user.email} />
        <ReadCard label="Số điện thoại" value={user.phone || "—"} />
      </div>
      <p className="mt-2 text-xs text-ink/40">
        Họ tên, email &amp; số điện thoại gắn với tài khoản đăng nhập. Cần thay đổi? Vui lòng liên hệ hỗ trợ.
      </p>

      {/* Người giới thiệu (F1 upline) — ai đang "ăn ref" của tài khoản này. */}
      <ReferrerCard />

      {/* CTV: danh sách khách F1 mình đã giới thiệu (1 tầng, không F2/F3). */}
      <ReferredCustomersSection role={user.role} />

      {/* Hồ sơ chi tiết — người dùng tự cập nhật */}
      <form onSubmit={save} className="card mt-8 grid gap-4 p-6 sm:grid-cols-2">
        <h2 className="font-serif text-lg font-semibold text-forest-900 sm:col-span-2">Hồ sơ chi tiết</h2>
        <label className="block sm:col-span-2">
          <span className="f-label">Địa chỉ liên hệ / nhận hàng</span>
          <input className="f-input" value={p.contact_address} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
            onChange={(e) => set("contact_address", e.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className="f-label">Địa chỉ thường trú</span>
          <input className="f-input" value={p.permanent_address} onChange={(e) => set("permanent_address", e.target.value)} />
        </label>
        <label className="block">
          <span className="f-label">Ngày sinh</span>
          <input type="date" className="f-input" value={p.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
        </label>
        <label className="block">
          <span className="f-label">Giới tính</span>
          <select className="f-select" value={p.gender} onChange={(e) => set("gender", e.target.value)}>
            <option value="">— Chọn —</option>
            <option value="Nam">Nam</option>
            <option value="Nữ">Nữ</option>
            <option value="Khác">Khác</option>
          </select>
        </label>
        <label className="block">
          <span className="f-label">Nghề nghiệp</span>
          <input className="f-input" value={p.occupation} onChange={(e) => set("occupation", e.target.value)} />
        </label>
        <label className="block">
          <span className="f-label">Quốc tịch</span>
          <input className="f-input" value={p.nationality} onChange={(e) => set("nationality", e.target.value)} />
        </label>
        <label className="block">
          <span className="f-label">Số CCCD / CMND</span>
          <input className="f-input" value={p.cccd_number} onChange={(e) => set("cccd_number", e.target.value)} />
        </label>
        <label className="block">
          <span className="f-label">Mã số thuế (nếu có)</span>
          <input className="f-input" value={p.tax_code} onChange={(e) => set("tax_code", e.target.value)} />
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={saving || !loaded} className="btn btn-gold px-6 py-2.5 text-sm disabled:opacity-60">
            {saving ? "Đang lưu..." : "Lưu thông tin"}
          </button>
          {saved && <span className="text-sm text-green-700">Đã lưu ✓</span>}
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      </form>
    </div>
  );
}

function ReadCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs text-ink/50">{label}</p>
      <p className="mt-1 font-medium text-forest-900">{value}</p>
    </div>
  );
}

const dateFmt = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

function formatDate(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? "—" : dateFmt.format(t);
}

// Người giới thiệu (F1 upline): CTV đã giới thiệu tài khoản này. Khoá first-touch theo SĐT ở
// backend — đã gắn là gắn vĩnh viễn, nên đây là thông tin CHỈ ĐỌC.
function ReferrerCard() {
  const [ref, setRef] = useState<ReferrerInfo | null | undefined>(undefined);

  useEffect(() => {
    investMyReferrer().then((r) => setRef(r));
  }, []);

  if (ref === undefined) {
    return <p className="mt-6 text-sm text-ink/40">Đang tải thông tin người giới thiệu…</p>;
  }

  if (!ref) {
    return (
      <div className="mt-6 rounded-xl border border-cream-200 bg-white p-5">
        <p className="text-xs uppercase tracking-wide text-ink/45">Người giới thiệu</p>
        <p className="mt-1.5 text-sm text-ink/60">
          Bạn chưa được ai giới thiệu — tài khoản không gắn với Cộng tác viên nào.
        </p>
      </div>
    );
  }

  const initials =
    ref.full_name.trim().split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join("").toUpperCase() || "HK";

  return (
    <div className="mt-6 rounded-xl border border-gold-200 bg-gold-50/50 p-5">
      <p className="text-xs uppercase tracking-wide text-ink/45">Người giới thiệu của bạn</p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-forest-800 font-serif text-base font-bold text-gold-400">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-forest-900">{ref.full_name}</p>
          <p className="mt-0.5 text-xs text-ink/50">
            {ROLE_LABEL[ref.role] ?? ref.role} · Mã <span className="font-mono text-forest-700">{ref.referral_code}</span> · Gắn từ {formatDate(ref.locked_at)}
          </p>
        </div>
        {ref.phone && (
          <a
            href={`tel:${ref.phone.replace(/\s/g, "")}`}
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-forest-300 px-3.5 py-1.5 text-xs font-medium text-forest-700 transition-colors hover:bg-white"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            {ref.phone}
          </a>
        )}
      </div>
      <p className="mt-3 text-xs text-ink/45">
        Người giới thiệu được gắn vĩnh viễn theo số điện thoại ngay lần đầu bạn đăng ký/mua qua link của họ.
      </p>
    </div>
  );
}

// Khách F1 của CTV: những khách đã bị khoá về mình + họ đã mua bao nhiêu và mình nhận bao nhiêu
// hoa hồng từ họ. Affiliate shop CHỈ 1 TẦNG nên không có F2/F3.
function ReferredCustomersSection({ role }: { role: string }) {
  const [list, setList] = useState<ReferredCustomer[] | null | undefined>(undefined);
  const isSaler = role === "saler" || role === "admin";

  useEffect(() => {
    if (!isSaler) return;
    investMyReferredCustomers().then((l) => setList(l));
  }, [isSaler]);

  if (!isSaler) return null;
  if (list === undefined) return <p className="mt-8 text-sm text-ink/40">Đang tải danh sách khách F1…</p>;

  const rows = list ?? [];
  const buyers = rows.filter((r) => r.orders_paid > 0).length;
  const commission = rows.reduce((a, r) => a + r.commission_vnd, 0);

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl font-bold text-forest-900">Khách F1 bạn giới thiệu</h2>
        <p className="text-sm text-ink/50">
          {rows.length} khách · {buyers} đã mua · hoa hồng <strong className="text-forest-800">{formatVND(commission)}</strong>
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card mt-4 p-8 text-center text-sm text-ink/50">
          Chưa có khách nào gắn với bạn. Chia sẻ link giới thiệu (hoặc mã QR) ở trang{" "}
          <Link href="/affiliate" className="font-medium text-forest-700 hover:text-gold-600">Tài khoản</Link> để bắt đầu.
        </div>
      ) : (
        <div className="card mt-4 overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink/45">
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Số điện thoại</th>
                <th className="px-4 py-3">Gắn từ</th>
                <th className="px-4 py-3 text-right">Đơn đã TT</th>
                <th className="px-4 py-3 text-right">Doanh số</th>
                <th className="px-4 py-3 text-right">Hoa hồng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.phone} className="border-b border-cream-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-forest-900">
                    {r.full_name || "Khách chưa có tên"}
                    {!r.has_account && <span className="ml-1.5 text-xs font-normal text-ink/40">(chưa có tài khoản)</span>}
                  </td>
                  <td className="num px-4 py-3 text-ink/70">{r.phone}</td>
                  <td className="px-4 py-3 text-ink/60">{formatDate(r.locked_at)}</td>
                  <td className="num px-4 py-3 text-right text-ink/70">{r.orders_paid}</td>
                  <td className="num px-4 py-3 text-right text-ink/70">{formatVND(r.revenue_vnd)}</td>
                  <td className="num px-4 py-3 text-right font-semibold text-forest-800">{formatVND(r.commission_vnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-ink/40">
        Hoa hồng tính trên đơn ĐÃ THANH TOÁN của khách F1 (đã trừ thuế TNCN). Affiliate chỉ 1 tầng — không có F2/F3.
      </p>
    </section>
  );
}
