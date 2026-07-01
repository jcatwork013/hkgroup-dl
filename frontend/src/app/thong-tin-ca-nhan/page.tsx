"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useAuth,
  investProfile,
  investSaveProfile,
  ROLE_LABEL,
  type FullProfile,
} from "@/lib/invest-auth";
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
