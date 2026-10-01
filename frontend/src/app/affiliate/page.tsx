"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  investLogin,
  investRegisterCustomer,
  investLogout,
  investGet,
  investForgotPassword,
  investRequestAffiliate,
  investWallet,
  investRequestWithdrawal,
  investProfile,
  investSaveBank,
  useAuth,
  ROLE_LABEL,
  VN_BANKS,
  type SalesCommission,
  type Wallet,
} from "@/lib/invest-auth";
import { formatVND } from "@/lib/format";
import { captureRef } from "@/lib/cart";
import { AccountTabs } from "@/components/AccountTabs";
import { StatCard } from "@/components/StatCard";
import { QrCode, useQrDataUrl } from "@/components/QrCode";

const COMM_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Chờ duyệt", cls: "bg-amber-100 text-amber-700" },
  approved: { label: "Đã duyệt", cls: "bg-blue-100 text-blue-700" },
  paid: { label: "Đã trả", cls: "bg-green-100 text-green-700" },
};

export default function AccountPage() {
  const { user, ready } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [forgotMsg, setForgotMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [commissions, setCommissions] = useState<SalesCommission[] | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState<"wallet" | "policy">("wallet");
  const [refCode, setRefCode] = useState("");

  const isAffiliate = user?.role === "saler";

  useEffect(() => {
    if (isAffiliate) {
      investGet<SalesCommission[]>("/api/v1/sales/my-commissions").then((cs) => setCommissions(cs ?? []));
      investWallet().then(setWallet);
    }
  }, [isAffiliate]);

  // CHỈ khi URL có ?ref= (link giới thiệu thật) mới tự mở form ĐĂNG KÝ + gắn mã. KHÔNG đọc lại mã
  // đã lưu (localStorage) — nếu không, mở /affiliate trơn sau khi từng vào link ref sẽ "dính" mã cũ.
  useEffect(() => {
    const r = (new URLSearchParams(window.location.search).get("ref") || "").trim();
    if (r) {
      captureRef(); // lưu cho luồng thanh toán (chỉ khi thực sự vào từ link ref)
      setRefCode(r);
      setMode("register");
    }
  }, []);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await investLogin(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    } finally {
      setLoading(false);
    }
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await investRegisterCustomer({ full_name: fullName.trim(), phone: phone.trim(), email: email.trim(), password, ref_code: refCode || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng ký thất bại.");
    } finally {
      setLoading(false);
    }
  }

  function onLogout() {
    investLogout();
    setEmail("");
    setPassword("");
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotMsg(null);
    setLoading(true);
    const res = await investForgotPassword(email.trim());
    setForgotMsg({ ok: res.ok, text: res.message });
    setLoading(false);
  }

  async function onRequestAffiliate() {
    setBusy("affiliate");
    await investRequestAffiliate();
    setBusy("");
  }

  async function onWithdraw() {
    if (!wallet || wallet.available_vnd <= 0) return;
    if (!window.confirm(`Gửi yêu cầu thanh toán hoa hồng ${formatVND(wallet.available_vnd)}?`)) return;
    setBusy("withdraw");
    const res = await investRequestWithdrawal(wallet.available_vnd, "Rút hoa hồng bán hàng");
    window.alert(res.message);
    if (res.ok) investWallet().then(setWallet);
    setBusy("");
  }

  /* ---------------- CHƯA ĐĂNG NHẬP: login / đăng ký / quên mật khẩu ---------------- */
  if (!user) {
    const isReg = mode === "register";
    const isForgot = mode === "forgot";
    const title = isForgot ? "Quên mật khẩu" : isReg ? "Đăng ký tài khoản" : "Đăng nhập";
    return (
      <div className="container-hk flex min-h-[70vh] max-w-md flex-col justify-center py-16">
        <div className="card p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-forest-800 font-serif text-lg font-bold text-gold-400">HK</div>
            <h1 className="font-serif text-2xl font-bold text-forest-900">{title}</h1>
            <p className="mt-1 text-sm text-ink/50">
              {isForgot
                ? "Nhập email — chúng tôi sẽ gửi link đặt lại mật khẩu."
                : isReg
                ? refCode
                  ? "Tạo tài khoản để mua hàng & theo dõi đơn của bạn."
                  : "Tạo tài khoản để mua hàng & theo dõi đơn. Muốn làm CTV bán hàng? Đăng ký sau khi đăng nhập."
                : "Đăng nhập tài khoản HKGROUP của bạn."}
            </p>
          </div>

          {isForgot ? (
            <form onSubmit={onForgot} className="space-y-4">
              <label className="block">
                <span className="f-label">Email</span>
                <input type="email" className="f-input" value={email} placeholder="email@vidu.com" onChange={(e) => setEmail(e.target.value)} required />
              </label>
              {forgotMsg && (
                <p className={`rounded-lg px-3 py-2 text-sm ${forgotMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{forgotMsg.text}</p>
              )}
              <button type="submit" disabled={loading} className="btn btn-gold w-full py-3 text-sm disabled:opacity-60">
                {loading ? "Đang gửi..." : "Gửi link đặt lại"}
              </button>
              <p className="text-center text-xs text-ink/50">
                <button type="button" onClick={() => { setMode("login"); setForgotMsg(null); }} className="font-medium text-forest-700 hover:text-gold-600">← Quay lại đăng nhập</button>
              </p>
            </form>
          ) : (
            <>
              <form onSubmit={isReg ? onRegister : onLogin} className="space-y-4">
                {isReg && (
                  <>
                    <label className="block">
                      <span className="f-label">Họ và tên</span>
                      <input className="f-input" value={fullName} placeholder="Nguyễn Văn A" onChange={(e) => setFullName(e.target.value)} required />
                    </label>
                    <label className="block">
                      <span className="f-label">Số điện thoại</span>
                      <input className="f-input" value={phone} placeholder="09xx xxx xxx" onChange={(e) => setPhone(e.target.value)} required />
                    </label>
                    {refCode && (
                      <label className="block">
                        <span className="f-label">Mã giới thiệu</span>
                        <input className="f-input bg-cream-100/60 font-mono tracking-wide text-forest-800" value={refCode} readOnly />
                        <span className="mt-1 block text-xs text-gold-600">✓ Bạn đăng ký qua lời giới thiệu.</span>
                      </label>
                    )}
                  </>
                )}
                <label className="block">
                  <span className="f-label">Email</span>
                  <input type="email" className="f-input" value={email} placeholder="email@vidu.com" onChange={(e) => setEmail(e.target.value)} required />
                </label>
                <label className="block">
                  <span className="f-label">Mật khẩu {isReg && <span className="text-ink/40">(≥ 8 ký tự)</span>}</span>
                  <input type="password" className="f-input" value={password} placeholder="••••••••" minLength={isReg ? 8 : undefined} onChange={(e) => setPassword(e.target.value)} required />
                </label>
                {!isReg && (
                  <div className="text-right">
                    <button type="button" onClick={() => { setMode("forgot"); setError(""); setForgotMsg(null); }} className="text-xs font-medium text-forest-700 hover:text-gold-600">Quên mật khẩu?</button>
                  </div>
                )}
                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
                <button type="submit" disabled={loading} className="btn btn-gold w-full py-3 text-sm disabled:opacity-60">
                  {loading ? "Đang xử lý..." : isReg ? "Đăng ký" : "Đăng nhập"}
                </button>
              </form>
              <p className="mt-5 text-center text-xs text-ink/50">
                {isReg ? (
                  <>Đã có tài khoản?{" "}
                    <button type="button" onClick={() => { setMode("login"); setError(""); }} className="font-medium text-forest-700 hover:text-gold-600">Đăng nhập</button>
                  </>
                ) : (
                  <>Chưa có tài khoản?{" "}
                    <button type="button" onClick={() => { setMode("register"); setError(""); }} className="font-medium text-forest-700 hover:text-gold-600">Đăng ký ngay</button>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ---------------- ĐÃ ĐĂNG NHẬP ---------------- */
  const initials =
    user.full_name.trim().split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join("").toUpperCase() || "HK";
  return (
    <div className="container-hk max-w-3xl py-12 sm:py-16">
      <AccountTabs active="account" />

      {/* Header tài khoản — panel xanh rêu gradient, avatar chữ cái, chip vai trò */}
      <div className="mt-6 overflow-hidden rounded-card border border-cream-200 shadow-sm">
        <div className="hero-bg px-6 py-7 sm:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gold-500 font-serif text-2xl font-bold text-forest-950 ring-4 ring-white/10">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-300/90">Tài khoản HKGROUP</p>
              <h1 className="mt-0.5 truncate font-serif text-2xl font-bold text-cream-50 sm:text-3xl">{user.full_name}</h1>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-cream-50 ring-1 ring-white/15">
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="shrink-0 self-start rounded-full border border-white/25 px-4 py-2 text-sm text-cream-50 transition-colors hover:bg-white/10"
            >
              Đăng xuất
            </button>
          </div>
        </div>
        <div className="grid divide-cream-200 bg-white sm:grid-cols-2 sm:divide-x">
          <ContactItem label="Email" value={user.email}>
            <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
            <path d="m22 6-10 7L2 6" />
          </ContactItem>
          <ContactItem label="Số điện thoại" value={user.phone || "—"}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
          </ContactItem>
        </div>
      </div>

      {isAffiliate && (
        <div className="mt-4">
          <ReferralLinkCard code={user.referral_code} />
        </div>
      )}

      {/* Khách hàng: mời/đăng ký làm Cộng tác viên */}
      {user.role === "customer" && (
        <div className="mt-6 rounded-xl border border-gold-200 bg-gold-50/50 p-5">
          {user.affiliate_status === "pending" ? (
            <p className="text-sm text-ink/70">
              ⏳ Yêu cầu trở thành <strong>Cộng tác viên bán hàng</strong> của bạn đang chờ quản trị duyệt.
            </p>
          ) : (
            <>
              <p className="text-sm text-ink/70">
                Trở thành <strong>Cộng tác viên bán hàng</strong> để chia sẻ sản phẩm &amp; nhận hoa hồng theo mỗi đơn.
                {user.affiliate_status === "rejected" && " (Yêu cầu trước đã bị từ chối — bạn có thể gửi lại.)"}
              </p>
              <button onClick={onRequestAffiliate} disabled={busy === "affiliate"} className="btn btn-gold mt-3 inline-flex px-5 py-2 text-sm disabled:opacity-60">
                {busy === "affiliate" ? "Đang gửi..." : "Đăng ký làm Cộng tác viên"}
              </button>
            </>
          )}
        </div>
      )}

      {user.role === "investor" && (
        <div className="mt-6 rounded-xl border border-forest-200 bg-forest-50/60 p-5">
          <p className="text-sm text-ink/70">Bạn là <strong>Nhà đầu tư</strong>. Theo dõi cổ phần &amp; cổ tức tại cổng đầu tư.</p>
          <a href="https://invest.duoclieuhk.vn" className="btn btn-gold mt-3 inline-flex px-5 py-2 text-sm">Vào cổng đầu tư →</a>
        </div>
      )}
      {user.role === "admin" && (
        <div className="mt-6 rounded-xl border border-gold-200 bg-gold-50/50 p-5">
          <p className="text-sm text-ink/70">Bạn là <strong>Quản trị viên</strong>. Cấu hình sản phẩm, nội dung, hoa hồng &amp; duyệt CTV tại trang quản trị.</p>
          <a href="https://admin.duoclieuhk.vn/admin" className="btn btn-gold mt-3 inline-flex px-5 py-2 text-sm">Vào trang quản trị →</a>
        </div>
      )}

      {/* Điều hướng nhanh tới hồ sơ & giao dịch cho MỌI người dùng */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/thong-tin-ca-nhan" className="card group flex items-center justify-between p-5 transition-colors hover:border-forest-300">
          <div>
            <p className="font-semibold text-forest-900">Thông tin cá nhân</p>
            <p className="mt-0.5 text-xs text-ink/50">Cập nhật địa chỉ, hồ sơ của bạn</p>
          </div>
          <span className="text-forest-400 transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
        <Link href="/lich-su-giao-dich" className="card group flex items-center justify-between p-5 transition-colors hover:border-forest-300">
          <div>
            <p className="font-semibold text-forest-900">Lịch sử giao dịch</p>
            <p className="mt-0.5 text-xs text-ink/50">Đơn mua, hoa hồng &amp; rút tiền</p>
          </div>
          <span className="text-forest-400 transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </div>

      {/* Cộng tác viên: tab hoa hồng + tab Chính sách hoa hồng */}
      {isAffiliate && (
        <div className="mt-8">
          <div className="flex gap-1 border-b border-cream-200">
            {([["wallet", "Hoa hồng affiliate"], ["policy", "Chính sách hoa hồng"]] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === k ? "border-gold-500 text-forest-900" : "border-transparent text-ink/50 hover:text-forest-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "wallet" ? (
            <>
              <BankInfoCard />
              <PayoutCard wallet={wallet} onWithdraw={onWithdraw} busy={busy === "withdraw"} />
              <CommissionBoard commissions={commissions} />
            </>
          ) : (
            <CommissionPolicy />
          )}
        </div>
      )}

      {!ready && <p className="mt-4 text-xs text-ink/40">Đang đồng bộ phiên đăng nhập…</p>}
    </div>
  );
}

// Dòng thông tin liên hệ trong header (email / SĐT) — icon line-art + nhãn + giá trị.
function ContactItem({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-6 py-4 sm:px-8">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-50 text-forest-700">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {children}
        </svg>
      </span>
      <div className="min-w-0">
        <p className="text-xs text-ink/50">{label}</p>
        <p className="truncate font-medium text-forest-900">{value}</p>
      </div>
    </div>
  );
}

// Link giới thiệu của CTV — copy & share. Đây là LINK ĐĂNG KÝ: khách mở link (/affiliate?ref=CODE)
// → khung đăng ký hiện sẵn mã → đăng ký xong bị KHOÁ theo SĐT về CTV này → mọi đơn sau của khách
// đổ hoa hồng về đúng người giới thiệu ("ăn ref").
function ReferralLinkCard({ code }: { code: string }) {
  // Tách thân card ra component riêng: phần thân dùng hook (QR) nên KHÔNG được nằm sau early-return.
  if (!code) {
    return (
      <div className="card p-5 sm:col-span-2">
        <p className="text-xs text-ink/50">Link giới thiệu</p>
        <p className="mt-1 text-sm text-ink/50">Chưa có mã giới thiệu. Vui lòng liên hệ quản trị.</p>
      </div>
    );
  }
  return <ReferralLinkBody code={code} />;
}

function ReferralLinkBody({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://duoclieuhk.vn";
  const link = `${origin}/affiliate?ref=${code}`;
  const { src: qr, failed: qrFailed } = useQrDataUrl(link);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt("Sao chép link giới thiệu:", link);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="card p-5 sm:col-span-2">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink/50">Link giới thiệu <span className="font-mono text-forest-700">({code})</span></p>
          <p className="mt-2 break-all font-mono text-sm text-forest-800">{link}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={copy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-forest-300 px-3.5 py-1.5 text-xs font-medium text-forest-700 transition-colors hover:bg-forest-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              {copied ? "Đã copy ✓" : "Copy link"}
            </button>
            {qr && (
              <a
                href={qr}
                download={`qr-gioi-thieu-${code}.png`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-forest-300 px-3.5 py-1.5 text-xs font-medium text-forest-700 transition-colors hover:bg-forest-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" />
                </svg>
                Tải ảnh QR
              </a>
            )}
          </div>
          <p className="mt-3 text-xs text-ink/45">
            Chia sẻ link hoặc để khách quét mã QR — khách sẽ thấy khung đăng ký kèm mã của bạn. Đăng ký xong, mọi đơn mua của họ đều ghi hoa hồng về bạn.
          </p>
        </div>

        {/* QR của chính link đăng ký ở trên — in ra card/standee, khách quét là vào form đăng ký. */}
        {!qrFailed && (
          <div className="flex shrink-0 flex-col items-center gap-1.5 self-center sm:self-start">
            <QrCode src={qr} size={148} alt={`Mã QR link giới thiệu ${code}`} />
            <span className="text-[11px] text-ink/45">Quét để đăng ký</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Chính sách hoa hồng cho CTV — nội dung do admin cấu hình (policy "hoa-hong-ctv").
function CommissionPolicy() {
  const INVEST = process.env.NEXT_PUBLIC_INVEST_API_URL ?? "http://localhost:8080";
  const [policy, setPolicy] = useState<{ title: string; body: string } | null | undefined>(undefined);
  useEffect(() => {
    fetch(`${INVEST}/api/v1/policies/hoa-hong-ctv`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setPolicy)
      .catch(() => setPolicy(null));
  }, [INVEST]);

  if (policy === undefined) return <p className="mt-6 text-sm text-ink/40">Đang tải chính sách…</p>;
  if (!policy) return <p className="mt-6 text-sm text-ink/50">Chưa có chính sách hoa hồng. Vui lòng liên hệ quản trị.</p>;
  const paragraphs = policy.body.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  return (
    <div className="card mt-6 p-6">
      <h3 className="font-serif text-lg font-bold text-forest-900">{policy.title}</h3>
      <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink/70">
        {paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line">{p}</p>
        ))}
      </div>
    </div>
  );
}

// Thông tin nhận hoa hồng (tài khoản ngân hàng) — bảo mật, chỉ chủ tài khoản & admin thấy.
function BankInfoCard() {
  const [bank, setBank] = useState({ bank_name: "", bank_account_number: "", bank_account_name: "" });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    investProfile().then((p) => {
      if (p)
        setBank({
          bank_name: (p.bank_name as string) || "",
          bank_account_number: (p.bank_account_number as string) || "",
          bank_account_name: (p.bank_account_name as string) || "",
        });
      setLoaded(true);
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setSaving(true);
    const ok = await investSaveBank(bank);
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setErr("Không lưu được. Phiên đăng nhập có thể đã hết hạn — hãy đăng xuất và đăng nhập lại.");
    }
  }

  return (
    <section className="mt-8">
      <h2 className="font-serif text-xl font-bold text-forest-900">Thông tin nhận hoa hồng</h2>
      <p className="mt-1 text-sm text-ink/50">🔒 Tài khoản ngân hàng để nhận thanh toán hoa hồng. Chỉ bạn &amp; quản trị viên xem được.</p>
      <form onSubmit={save} className="card mt-4 grid gap-4 p-6 sm:grid-cols-2">
        <label className="block">
          <span className="f-label">Ngân hàng</span>
          <select className="f-input" value={bank.bank_name} onChange={(e) => setBank({ ...bank, bank_name: e.target.value })} required>
            <option value="">— Chọn ngân hàng —</option>
            {VN_BANKS.map((b) => (
              <option key={b.code} value={b.code}>{b.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="f-label">Số tài khoản</span>
          <input className="f-input" value={bank.bank_account_number} onChange={(e) => setBank({ ...bank, bank_account_number: e.target.value })} required />
        </label>
        <label className="block sm:col-span-2">
          <span className="f-label">Chủ tài khoản (viết hoa, không dấu)</span>
          <input className="f-input" value={bank.bank_account_name} placeholder="NGUYEN VAN A" onChange={(e) => setBank({ ...bank, bank_account_name: e.target.value.toUpperCase() })} required />
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={saving || !loaded} className="btn btn-gold px-6 py-2.5 text-sm disabled:opacity-60">
            {saving ? "Đang lưu..." : "Lưu thông tin"}
          </button>
          {saved && <span className="text-sm text-green-700">Đã lưu ✓</span>}
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      </form>
    </section>
  );
}

// Tài khoản hoa hồng affiliate + nút yêu cầu thanh toán.
function PayoutCard({ wallet, onWithdraw, busy }: { wallet: Wallet | null; onWithdraw: () => void; busy: boolean }) {
  return (
    <section className="mt-8">
      <h2 className="font-serif text-xl font-bold text-forest-900">Tài khoản hoa hồng affiliate</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Khả dụng (có thể rút)" value={formatVND(wallet?.available_vnd ?? 0)} tone="forest" hint="Sẵn sàng thanh toán" />
        <StatCard label="Chờ duyệt" value={formatVND(wallet?.pending_vnd ?? 0)} tone="gold" hint="Hoa hồng đang xét" />
        <StatCard label="Đã rút / đang xử lý" value={formatVND(wallet?.withdrawn_vnd ?? 0)} hint="Đã yêu cầu thanh toán" />
      </div>
      <button
        onClick={onWithdraw}
        disabled={busy || !wallet || wallet.available_vnd <= 0}
        className="btn btn-gold mt-4 inline-flex px-6 py-2.5 text-sm disabled:opacity-50"
      >
        {busy ? "Đang gửi..." : "Yêu cầu thanh toán hoa hồng"}
      </button>
      <p className="mt-2 text-xs text-ink/40">Yêu cầu được gửi tới quản trị; thanh toán theo lịch rút của công ty.</p>
    </section>
  );
}

// Bảng hoa hồng liên kết cho Cộng tác viên bán hàng.
function CommissionBoard({ commissions }: { commissions: SalesCommission[] | null }) {
  if (commissions === null) return <p className="mt-6 text-sm text-ink/40">Đang tải bảng hoa hồng…</p>;
  const sum = (f: (c: SalesCommission) => number) => commissions.reduce((a, c) => a + f(c), 0);
  const paid = sum((c) => (c.status === "paid" ? c.net_amount : 0));

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-bold text-forest-900">Hoa hồng liên kết</h2>
        <span className="text-sm text-ink/50">Đã trả: <strong className="text-green-700">{formatVND(paid)}</strong></span>
      </div>
      {commissions.length === 0 ? (
        <div className="card mt-4 p-8 text-center text-sm text-ink/50">
          Chưa có hoa hồng. Chia sẻ link sản phẩm kèm mã giới thiệu của bạn để bắt đầu.
        </div>
      ) : (
        <div className="card mt-4 overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink/45">
                <th className="px-4 py-3">Loại</th>
                <th className="px-4 py-3 text-right">Doanh số đơn</th>
                <th className="px-4 py-3 text-right">Tỷ lệ</th>
                <th className="px-4 py-3 text-right">Thực nhận</th>
                <th className="px-4 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => {
                const st = COMM_STATUS[c.status] ?? { label: c.status, cls: "bg-cream-200 text-ink/60" };
                return (
                  <tr key={c.id} className="border-b border-cream-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-forest-900">{c.kind === "affiliate" ? "Giới thiệu" : "Người bán"}</td>
                    <td className="num px-4 py-3 text-right text-ink/70">{formatVND(c.base_amount)}</td>
                    <td className="px-4 py-3 text-right text-ink/70">{(c.rate * 100).toFixed(1)}%</td>
                    <td className="num px-4 py-3 text-right font-semibold text-forest-800">{formatVND(c.net_amount)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
