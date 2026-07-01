"use client";

import { useState } from "react";
import { StatCard } from "@/components/StatCard";
import { API_URL } from "@/lib/api";
import { formatVND, formatNumber, formatPercent } from "@/lib/format";

type Dashboard = {
  ref_code: string;
  clicks: number;
  success_orders: number;
  conversion_rate: number;
  commission_available: number;
  commission_paid: number;
  commission_holding: number;
};

export default function AffiliatePage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      if (!res.ok) {
        setError("Đăng nhập thất bại. Kiểm tra email/SĐT và mật khẩu.");
        return;
      }
      const json = (await res.json()) as { tokens: { access_token: string } };
      const tk = json.tokens.access_token;
      setToken(tk);
      await loadDashboard(tk);
    } catch {
      setError("Không kết nối được máy chủ. Backend đã chạy chưa?");
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboard(tk: string) {
    const res = await fetch(`${API_URL}/api/affiliate/dashboard`, {
      headers: { Authorization: `Bearer ${tk}` },
    });
    if (res.ok) {
      setData((await res.json()) as Dashboard);
    } else if (res.status === 403) {
      setError("Tài khoản này không có quyền Affiliate.");
    }
  }

  if (!token || !data) {
    return (
      <div className="container-hk flex min-h-[70vh] max-w-md flex-col justify-center py-16">
        <div className="card p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-forest-800 font-serif text-lg font-bold text-gold-400">HK</div>
            <h1 className="font-serif text-2xl font-bold text-forest-900">Affiliate</h1>
            <p className="mt-1 text-sm text-ink/50">Đăng nhập để xem hiệu suất & hoa hồng của bạn.</p>
          </div>
          <form onSubmit={login} className="space-y-4">
            <label className="block">
              <span className="f-label">Email hoặc số điện thoại</span>
              <input className="f-input" value={identifier} placeholder="email@vidu.com" onChange={(e) => setIdentifier(e.target.value)} required />
            </label>
            <label className="block">
              <span className="f-label">Mật khẩu</span>
              <input type="password" className="f-input" value={password} placeholder="••••••••" onChange={(e) => setPassword(e.target.value)} required />
            </label>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="btn btn-gold w-full py-3 text-sm disabled:opacity-60">
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">Affiliate Dashboard</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-forest-900">Hiệu suất của bạn</h1>
        </div>
        <div className="card px-5 py-3">
          <p className="text-xs text-ink/50">Mã giới thiệu</p>
          <p className="font-mono text-lg font-bold text-forest-800">{data.ref_code || "—"}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Lượt click" value={formatNumber(data.clicks)} />
        <StatCard label="Đơn thành công" value={formatNumber(data.success_orders)} />
        <StatCard label="Tỷ lệ chuyển đổi" value={formatPercent(data.conversion_rate)} />
        <StatCard label="Hoa hồng chờ" value={formatVND(data.commission_available)} tone="gold" hint="Khả dụng để rút" />
        <StatCard label="Đang chờ duyệt rút" value={formatVND(data.commission_holding)} tone="forest" />
        <StatCard label="Đã thanh toán" value={formatVND(data.commission_paid)} tone="forest" />
      </div>

      <p className="mt-6 text-xs text-ink/40">
        * Số dư đọc trực tiếp từ sổ kép (double-entry ledger) — đối soát minh bạch từng đồng.
      </p>
    </div>
  );
}
