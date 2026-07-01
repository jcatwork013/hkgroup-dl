"use client";

// Auth CHUNG với hệ sinh thái invest: login trên duoclieuhk.vn bằng tài khoản của
// admin.duoclieuhk.vn / invest.duoclieuhk.vn. Gọi thẳng backend invest (JWT bearer).
// CORS invest đã cho phép origin https://duoclieuhk.vn.
import { useEffect, useState } from "react";

const INVEST = process.env.NEXT_PUBLIC_INVEST_API_URL ?? "http://localhost:8080";

// Pub/sub để mọi component (Navbar, trang tài khoản...) cập nhật NGAY khi login/logout,
// không cần reload trang.
type AuthListener = () => void;
const authListeners = new Set<AuthListener>();
function notifyAuth(): void {
  authListeners.forEach((l) => l());
}
export function subscribeAuth(l: AuthListener): () => void {
  authListeners.add(l);
  return () => {
    authListeners.delete(l);
  };
}

export type InvestUser = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string; // customer | investor | saler | admin
  kyc_status: string;
  kyc_message: string;
  referral_code: string;
  affiliate_status?: string; // none | pending | rejected | affiliate
};

export type Wallet = {
  earned_vnd: number;
  withdrawn_vnd: number;
  available_vnd: number;
  pending_vnd: number;
};

type Tokens = { access_token: string; refresh_token: string };

const AK = "hk_invest_access";
const RK = "hk_invest_refresh";
const UK = "hk_invest_user";

export function getAccess(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AK);
}

// Làm mới access token bằng refresh token (access TTL ngắn ~15'). Trả token mới hoặc null.
async function refreshAccess(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const rt = window.localStorage.getItem(RK);
  if (!rt) return null;
  try {
    const res = await fetch(`${INVEST}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { tokens: Tokens };
    window.localStorage.setItem(AK, data.tokens.access_token);
    window.localStorage.setItem(RK, data.tokens.refresh_token);
    return data.tokens.access_token;
  } catch {
    return null;
  }
}

// authedFetch: gắn Bearer token, tự refresh & thử lại 1 lần nếu 401 (token hết hạn).
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = (token: string) =>
    fetch(`${INVEST}${path}`, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
  let token = getAccess();
  if (!token) return new Response(null, { status: 401 });
  let res = await doFetch(token);
  if (res.status === 401) {
    const fresh = await refreshAccess();
    if (fresh) res = await doFetch(fresh);
  }
  return res;
}

function setSession(tokens: Tokens, user: InvestUser): void {
  window.localStorage.setItem(AK, tokens.access_token);
  window.localStorage.setItem(RK, tokens.refresh_token);
  window.localStorage.setItem(UK, JSON.stringify(user));
  notifyAuth();
}

export function getCachedUser(): InvestUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(UK);
  return raw ? (JSON.parse(raw) as InvestUser) : null;
}

export function investLogout(): void {
  [AK, RK, UK].forEach((k) => window.localStorage.removeItem(k));
  notifyAuth();
}

// Đăng nhập bằng email/mật khẩu của tài khoản invest. Trả user hoặc ném lỗi có message VN.
export async function investLogin(email: string, password: string): Promise<InvestUser> {
  const res = await fetch(`${INVEST}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Email hoặc mật khẩu không đúng.");
    // 403 = tài khoản bị khoá (hoặc lỗi khác) — hiện đúng thông báo từ máy chủ.
    let msg = "Đăng nhập thất bại. Vui lòng thử lại.";
    try {
      const e = (await res.json()) as { error?: string };
      if (e.error) msg = e.error;
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }
  const data = (await res.json()) as { user: InvestUser; tokens: Tokens };
  setSession(data.tokens, data.user);
  return data.user;
}

// Đăng ký KHÁCH HÀNG ngay trên website (role=customer). Muốn làm CTV thì gửi yêu cầu sau.
export async function investRegisterCustomer(input: {
  full_name: string;
  phone: string;
  email: string;
  password: string;
  ref_code?: string; // mã giới thiệu từ ?ref= — đăng ký qua link CTV để họ "ăn ref"
}): Promise<InvestUser> {
  const res = await fetch(`${INVEST}/api/v1/auth/register-customer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, email: input.email.trim().toLowerCase() }),
  });
  if (!res.ok) {
    if (res.status === 409) throw new Error("Email đã được đăng ký. Vui lòng đăng nhập.");
    throw new Error("Đăng ký thất bại. Kiểm tra thông tin (mật khẩu ≥ 8 ký tự).");
  }
  const data = (await res.json()) as { user: InvestUser; tokens: Tokens; affiliate_status?: string };
  const user = { ...data.user, affiliate_status: data.affiliate_status ?? "none" };
  setSession(data.tokens, user);
  return user;
}

// Khách hàng gửi yêu cầu trở thành Cộng tác viên. Refresh /me để cập nhật trạng thái.
export async function investRequestAffiliate(): Promise<boolean> {
  const res = await authedFetch("/api/v1/me/affiliate-request", { method: "POST" });
  if (res.ok) await investMe();
  return res.ok;
}

export async function investWallet(): Promise<Wallet | null> {
  return investGet<Wallet>("/api/v1/me/wallet");
}

// Quên mật khẩu: gửi email chứa link đặt lại (token). Link trỏ về /reset-password của web hiện tại.
export async function investForgotPassword(email: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${INVEST}/api/v1/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  if (res.ok) return { ok: true, message: "Nếu email tồn tại, link đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư." };
  let message = "Không gửi được email đặt lại. Vui lòng thử lại.";
  try {
    const e = (await res.json()) as { error?: string };
    if (e.error) message = e.error;
  } catch {
    /* keep default */
  }
  return { ok: false, message };
}

// Đặt mật khẩu mới bằng token từ email.
export async function investResetPassword(token: string, newPassword: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${INVEST}/api/v1/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  if (res.ok) return { ok: true, message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập." };
  let message = "Token không hợp lệ hoặc đã hết hạn.";
  try {
    const e = (await res.json()) as { error?: string };
    if (e.error) message = e.error;
  } catch {
    /* keep default */
  }
  return { ok: false, message };
}

export type BankInfo = { bank_name: string; bank_account_number: string; bank_account_name: string };

// Thông tin nhận hoa hồng (tài khoản ngân hàng) — lưu trong hồ sơ, chỉ chủ tài khoản & admin xem.
export async function investProfile(): Promise<Record<string, unknown> | null> {
  return investGet<Record<string, unknown>>("/api/v1/me/profile");
}

// Các field hồ sơ mà backend chấp nhận (decode dùng DisallowUnknownFields → KHÔNG gửi user_id/updated_at).
const PROFILE_FIELDS = [
  "date_of_birth", "gender", "nationality", "cccd_number", "cccd_issue_date", "cccd_issue_place",
  "permanent_address", "contact_address", "occupation", "tax_code",
  "bank_name", "bank_account_number", "bank_account_name",
] as const;

export async function investSaveBank(bank: BankInfo): Promise<boolean> {
  return investSaveProfile(bank as Partial<FullProfile>);
}

// FullProfile — toàn bộ field hồ sơ (khớp ProfileInput backend). Tất cả optional khi patch.
export type FullProfile = {
  date_of_birth: string;
  gender: string;
  nationality: string;
  cccd_number: string;
  cccd_issue_date: string;
  cccd_issue_place: string;
  permanent_address: string;
  contact_address: string;
  occupation: string;
  tax_code: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
};

// investSaveProfile: PUT /me/profile là ghi ĐÈ TOÀN BỘ (DisallowUnknownFields) nên phải nạp hồ sơ
// hiện tại rồi merge phần sửa, tránh xoá trắng các field không đụng tới.
export async function investSaveProfile(patch: Partial<FullProfile>): Promise<boolean> {
  const current = (await investProfile()) ?? {};
  const body: Record<string, unknown> = {};
  for (const k of PROFILE_FIELDS) body[k] = (current as Record<string, unknown>)[k] ?? "";
  Object.assign(body, patch);
  const res = await authedFetch("/api/v1/me/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

// Lịch sử rút hoa hồng của tài khoản đang đăng nhập.
export type MyWithdrawal = {
  id: string;
  amount: number;
  status: string; // pending | approved | rejected | paid
  note: string;
  requested_at: string;
  processed_at?: string | null;
};

export async function investMyWithdrawals(): Promise<MyWithdrawal[] | null> {
  return investGet<MyWithdrawal[]>("/api/v1/me/withdrawals");
}

// Danh sách ngân hàng phổ biến kèm mã VietQR (để sinh QR chuyển khoản).
export const VN_BANKS: { code: string; name: string }[] = [
  { code: "VCB", name: "Vietcombank" },
  { code: "TCB", name: "Techcombank" },
  { code: "BIDV", name: "BIDV" },
  { code: "VPB", name: "VPBank" },
  { code: "MB", name: "MB Bank" },
  { code: "ACB", name: "ACB" },
  { code: "VBA", name: "Agribank" },
  { code: "CTG", name: "VietinBank" },
  { code: "TPB", name: "TPBank" },
  { code: "STB", name: "Sacombank" },
  { code: "MSB", name: "MSB" },
  { code: "VIB", name: "VIB" },
  { code: "SHB", name: "SHB" },
  { code: "HDB", name: "HDBank" },
  { code: "OCB", name: "OCB" },
];

// Gửi yêu cầu thanh toán (rút) hoa hồng.
export async function investRequestWithdrawal(amount: number, note = ""): Promise<{ ok: boolean; message: string }> {
  const res = await authedFetch("/api/v1/me/withdrawals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, note }),
  });
  if (res.ok) return { ok: true, message: "Đã gửi yêu cầu thanh toán hoa hồng." };
  let message = "Gửi yêu cầu thất bại.";
  try {
    const e = (await res.json()) as { error?: string };
    if (e.error) message = e.error;
  } catch {
    /* keep default */
  }
  return { ok: false, message };
}

// Lấy thông tin tài khoản hiện tại (xác thực token còn hạn). null nếu chưa đăng nhập/hết hạn.
export async function investMe(): Promise<InvestUser | null> {
  if (!getAccess()) return null;
  try {
    const res = await authedFetch("/api/v1/me"); // tự refresh nếu access token hết hạn
    if (res.status === 401) {
      // refresh cũng hết hạn → coi như đăng xuất, cập nhật UI ngay.
      investLogout();
      return null;
    }
    if (!res.ok) return null;
    const user = (await res.json()) as InvestUser;
    window.localStorage.setItem(UK, JSON.stringify(user));
    notifyAuth();
    return user;
  } catch {
    return null;
  }
}

// Hook reactive: mọi component dùng useAuth() sẽ tự cập nhật khi login/logout — KHÔNG cần reload.
export function useAuth(): { user: InvestUser | null; ready: boolean } {
  const [user, setUser] = useState<InvestUser | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setUser(getCachedUser());
    const unsub = subscribeAuth(() => setUser(getCachedUser()));
    investMe().then(() => setReady(true));
    return unsub;
  }, []);
  return { user, ready };
}

// GET có kèm Bearer token tới API duy nhất (tự refresh nếu hết hạn). null nếu chưa đăng nhập / lỗi.
export async function investGet<T>(path: string): Promise<T | null> {
  try {
    const res = await authedFetch(path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export type SalesCommission = {
  id: string;
  kind: string; // seller | affiliate
  base_amount: number;
  rate: number;
  amount: number;
  net_amount: number;
  status: string; // pending | approved | paid
  created_at?: string;
};

// Lịch sử đơn MUA của khách (khớp theo SĐT hồ sơ). Khớp DTO CustomerOrder ở backend.
export type MyOrderItem = { name: string; qty: number; line_total_vnd: number };
export type MyOrder = {
  code: string;
  status: string; // pending | paid | cancelled
  subtotal_vnd: number;
  created_at: string;
  items: MyOrderItem[];
};

export async function investMyOrders(): Promise<MyOrder[] | null> {
  return investGet<MyOrder[]>("/api/v1/me/orders");
}

export const ROLE_LABEL: Record<string, string> = {
  admin: "Quản trị viên",
  saler: "Cộng tác viên bán hàng",
  investor: "Nhà đầu tư",
  customer: "Khách hàng",
};
