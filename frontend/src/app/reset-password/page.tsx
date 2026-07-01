"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { investResetPassword } from "@/lib/invest-auth";

function ResetInner() {
  const token = useSearchParams().get("token") ?? "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) {
      setMsg({ ok: false, text: "Mật khẩu nhập lại không khớp." });
      return;
    }
    setLoading(true);
    const res = await investResetPassword(token, pw);
    setMsg({ ok: res.ok, text: res.message });
    setLoading(false);
  }

  return (
    <div className="container-hk flex min-h-[70vh] max-w-md flex-col justify-center py-16">
      <div className="card p-8">
        <h1 className="font-serif text-2xl font-bold text-forest-900">Đặt lại mật khẩu</h1>
        {!token ? (
          <p className="mt-3 text-sm text-red-600">Thiếu mã đặt lại. Vui lòng mở lại link trong email.</p>
        ) : msg?.ok ? (
          <div className="mt-4">
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{msg.text}</p>
            <Link href="/affiliate" className="btn btn-gold mt-4 inline-flex px-6 py-2.5 text-sm">Đăng nhập</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block">
              <span className="f-label">Mật khẩu mới (≥ 8 ký tự)</span>
              <input type="password" className="f-input" value={pw} minLength={8} onChange={(e) => setPw(e.target.value)} required />
            </label>
            <label className="block">
              <span className="f-label">Nhập lại mật khẩu</span>
              <input type="password" className="f-input" value={pw2} minLength={8} onChange={(e) => setPw2(e.target.value)} required />
            </label>
            {msg && !msg.ok && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{msg.text}</p>}
            <button type="submit" disabled={loading} className="btn btn-gold w-full py-3 text-sm disabled:opacity-60">
              {loading ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="container-hk py-16 text-center text-ink/40">Đang tải…</div>}>
      <ResetInner />
    </Suspense>
  );
}
