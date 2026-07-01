"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

/* ───────────────────────── helpers ───────────────────────── */

const TOKEN_KEY = "hk_admin_token";

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

// Sau khi lưu, làm mới ISR cache trang public NGAY (best-effort, không chặn UX nếu lỗi).
async function triggerRevalidate(token: string): Promise<void> {
  try {
    await fetch("/api/revalidate", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  } catch {
    /* bỏ qua — cùng lắm trang tự revalidate theo timer */
  }
}

function setIn<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".");
  const clone: any = Array.isArray(obj) ? [...(obj as any)] : { ...(obj as any) };
  let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]!;
    cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...(cur[k] ?? {}) };
    cur = cur[k];
  }
  cur[keys[keys.length - 1]!] = value;
  return clone;
}

// slugify tiếng Việt -> ascii-kebab
function slugify(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-").replace(/-+/g, "-");
}

function Field({
  label, value, onChange, type = "text", textarea, placeholder, help,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; textarea?: boolean; placeholder?: string; help?: string;
}) {
  return (
    <label className="block">
      <span className="f-label">{label}</span>
      {textarea ? (
        <textarea className="f-textarea" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="f-input" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {help ? <span className="f-help">{help}</span> : null}
    </label>
  );
}

function ImageUploader({ token, onUploaded, multiple = false }: { token: string; onUploaded: (url: string) => void; multiple?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className={`dropzone ${busy ? "opacity-60" : ""}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
      </svg>
      {busy ? "Đang tải..." : multiple ? "Kéo thả hoặc bấm để tải nhiều ảnh" : "Tải ảnh lên"}
      <input
        type="file" accept="image/*" multiple={multiple} className="hidden" disabled={busy}
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length === 0) return;
          setBusy(true);
          try {
            for (const f of files) {
              const fd = new FormData();
              fd.append("file", f);
              const res = await fetch(`${API_URL}/api/admin/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
              const j = await res.json();
              if (j.url) onUploaded(j.url as string);
            }
          } finally { setBusy(false); e.target.value = ""; }
        }}
      />
    </label>
  );
}

/* ───────────────────────── page shell ───────────────────────── */

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<"content" | "products">("content");
  const [ready, setReady] = useState(false);

  useEffect(() => { setToken(localStorage.getItem(TOKEN_KEY)); setReady(true); }, []);
  const logout = () => { localStorage.removeItem(TOKEN_KEY); setToken(null); };

  if (!ready) return null;
  if (!token) return <Login onLogin={(t) => { localStorage.setItem(TOKEN_KEY, t); setToken(t); }} />;

  return (
    <div className="bg-cream-50">
      <div className="border-b border-cream-200 bg-white">
        <div className="container-hk flex flex-wrap items-center justify-between gap-3 py-5">
          <div>
            <h1 className="font-serif text-2xl font-bold text-forest-900">Bảng quản trị</h1>
            <p className="text-sm text-ink/50">Quản lý nội dung & sản phẩm HKGROUP</p>
          </div>
          <button onClick={logout} className="btn border border-cream-200 px-4 py-2 text-sm text-forest-800 hover:bg-cream-100">
            Đăng xuất
          </button>
        </div>
      </div>

      <div className="container-hk py-8">
        <div className="seg mb-8">
          {([["content", "Nội dung trang"], ["products", "Sản phẩm"]] as const).map(([k, label]) => (
            <button key={k} className="seg-btn" data-active={tab === k} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
        {tab === "content" ? <ContentEditor token={token} /> : <ProductsManager token={token} />}
      </div>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (t: string) => void }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="container-hk flex min-h-[70vh] max-w-md flex-col justify-center py-16">
      <div className="admin-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-forest-800 font-serif text-lg font-bold text-gold-400">HK</div>
          <h1 className="font-serif text-2xl font-bold text-forest-900">Đăng nhập quản trị</h1>
          <p className="mt-1 text-sm text-ink/50">Dành cho tài khoản admin</p>
        </div>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault(); setErr(""); setBusy(true);
            try {
              const res = await fetch(`${API_URL}/api/auth/login`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier: id, password: pw }),
              });
              if (!res.ok) { setErr("Sai email/SĐT hoặc mật khẩu."); return; }
              const j = await res.json();
              onLogin(j.tokens.access_token);
            } catch { setErr("Không kết nối được máy chủ."); }
            finally { setBusy(false); }
          }}
        >
          <Field label="Email hoặc số điện thoại" value={id} onChange={setId} placeholder="admin@hkgroup.vn" />
          <label className="block">
            <span className="f-label">Mật khẩu</span>
            <input type="password" className="f-input" value={pw} placeholder="••••••••" onChange={(e) => setPw(e.target.value)} />
          </label>
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
          <button disabled={busy} className="btn btn-gold w-full py-3 text-sm">{busy ? "Đang đăng nhập..." : "Đăng nhập"}</button>
        </form>
      </div>
    </div>
  );
}

/* ───────────────────────── content editor ───────────────────────── */

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="admin-card p-5 sm:p-6">
      <div className="mb-4 border-b border-cream-100 pb-3">
        <h2 className="font-serif text-lg font-semibold text-forest-900">{title}</h2>
        {desc ? <p className="mt-0.5 text-xs text-ink/45">{desc}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function ContentEditor({ token }: { token: string }) {
  const [s, setS] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch(`${API_URL}/api/settings`).then((r) => r.json()).then(setS).catch(() => setS({})); }, []);
  const up = useCallback((path: string, v: unknown) => setS((prev: any) => setIn(prev, path, v)), []);

  // Lưu NGAY 1 thay đổi (vd logo) mà không cần bấm "Lưu tất cả".
  const persist = useCallback(async (full: any, note: string) => {
    setMsg("");
    try {
      const res = await fetch(`${API_URL}/api/admin/settings`, { method: "PUT", headers: authHeaders(token), body: JSON.stringify(full) });
      if (res.ok) await triggerRevalidate(token);
      setMsg(res.ok ? note : "Lưu thất bại");
    } catch { setMsg("Lỗi kết nối"); }
  }, [token]);

  // Set logo + lưu tức thì.
  const setLogo = useCallback((url: string) => {
    setS((prev: any) => { const next = setIn(prev, "brand.logoUrl", url); void persist(next, url ? "✓ Đã cập nhật logo" : "✓ Đã xoá logo"); return next; });
  }, [persist]);

  if (!s) return <p className="text-ink/50">Đang tải...</p>;

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      const res = await fetch(`${API_URL}/api/admin/settings`, { method: "PUT", headers: authHeaders(token), body: JSON.stringify(s) });
      if (res.ok) await triggerRevalidate(token);
      setMsg(res.ok ? "✓ Đã lưu — giao diện public đã được cập nhật ngay" : "Lưu thất bại");
    } catch { setMsg("Lỗi kết nối"); }
    finally { setSaving(false); }
  };

  const stats: any[] = s.stats ?? [];
  const faq: any[] = s.faq ?? [];

  return (
    <div className="space-y-6 pb-24">
      <Card title="SEO" desc="Tiêu đề & mô tả hiển thị trên Google và khi chia sẻ link.">
        <Field label="Tiêu đề trang (title)" value={s.seo?.title ?? ""} onChange={(v) => up("seo.title", v)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mẫu tiêu đề" value={s.seo?.titleTemplate ?? ""} onChange={(v) => up("seo.titleTemplate", v)} help="Dùng %s cho tên trang con, vd: %s · HKGROUP" />
          <Field label="Từ khoá (keywords)" value={s.seo?.keywords ?? ""} onChange={(v) => up("seo.keywords", v)} />
        </div>
        <Field label="Mô tả (description)" textarea value={s.seo?.description ?? ""} onChange={(v) => up("seo.description", v)} />
      </Card>

      <Card title="Thương hiệu & Logo" desc="Logo hiển thị trên thanh điều hướng và chân trang.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên thương hiệu" value={s.brand?.name ?? ""} onChange={(v) => up("brand.name", v)} />
          <Field label="Tagline" value={s.brand?.tagline ?? ""} onChange={(v) => up("brand.tagline", v)} />
        </div>
        <div>
          <span className="f-label">Logo (tải lên & dùng ngay)</span>
          <div className="flex flex-wrap items-center gap-3">
            {/* xem trước trên đúng nền tối của thanh điều hướng */}
            <div className="flex h-14 min-w-[140px] items-center rounded-lg bg-forest-950 px-3">
              {s.brand?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.brand.logoUrl} alt="logo" className="h-9 w-auto max-w-[160px] object-contain" />
              ) : (
                <span className="font-serif text-base font-bold text-cream-50">HK<span className="text-gold-500">GROUP</span></span>
              )}
            </div>
            <ImageUploader token={token} onUploaded={setLogo} />
            {s.brand?.logoUrl && <button onClick={() => setLogo("")} className="text-xs font-medium text-red-600">Dùng lại mặc định</button>}
          </div>
          <span className="f-help">Nên dùng ảnh PNG/SVG nền trong suốt (thanh nav nền xanh đậm). Logo lưu & hiển thị ngay sau khi tải lên.</span>
        </div>
      </Card>

      <Card title="Hero (đầu trang chủ)" desc="Khối lớn nhất trên trang chủ.">
        <Field label="Eyebrow (dòng nhỏ phía trên)" value={s.hero?.eyebrow ?? ""} onChange={(v) => up("hero.eyebrow", v)} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Tiêu đề (đầu)" value={s.hero?.titleLead ?? ""} onChange={(v) => up("hero.titleLead", v)} />
          <Field label="Từ nhấn (màu vàng)" value={s.hero?.titleAccent ?? ""} onChange={(v) => up("hero.titleAccent", v)} />
          <Field label="Tiêu đề (cuối)" value={s.hero?.titleRest ?? ""} onChange={(v) => up("hero.titleRest", v)} />
        </div>
        <Field label="Mô tả phụ" textarea value={s.hero?.subtitle ?? ""} onChange={(v) => up("hero.subtitle", v)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nút chính" value={s.hero?.ctaPrimary ?? ""} onChange={(v) => up("hero.ctaPrimary", v)} />
          <Field label="Nút phụ" value={s.hero?.ctaSecondary ?? ""} onChange={(v) => up("hero.ctaSecondary", v)} />
        </div>
      </Card>

      <Card title="Chỉ số nổi bật" desc="3 con số hiển thị dưới hero.">
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((st, i) => (
            <div key={i} className="rounded-lg border border-cream-100 p-3">
              <Field label={`Giá trị ${i + 1}`} value={st.value ?? ""} onChange={(v) => up(`stats.${i}.value`, v)} />
              <div className="mt-2"><Field label="Nhãn" value={st.label ?? ""} onChange={(v) => up(`stats.${i}.label`, v)} /></div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Thông tin liên hệ">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Hotline" value={s.contact?.phone ?? ""} onChange={(v) => up("contact.phone", v)} />
          <Field label="Email" value={s.contact?.email ?? ""} onChange={(v) => up("contact.email", v)} />
          <Field label="Địa chỉ" value={s.contact?.address ?? ""} onChange={(v) => up("contact.address", v)} />
        </div>
      </Card>

      <Card title="Chân trang (Footer)">
        <Field label="Giới thiệu ngắn" textarea value={s.footer?.about ?? ""} onChange={(v) => up("footer.about", v)} />
        <Field label="Copyright" value={s.footer?.copyright ?? ""} onChange={(v) => up("footer.copyright", v)} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Facebook URL" value={s.footer?.facebook ?? ""} onChange={(v) => up("footer.facebook", v)} placeholder="https://facebook.com/..." />
          <Field label="YouTube URL" value={s.footer?.youtube ?? ""} onChange={(v) => up("footer.youtube", v)} placeholder="https://youtube.com/..." />
          <Field label="Zalo URL" value={s.footer?.zalo ?? ""} onChange={(v) => up("footer.zalo", v)} placeholder="https://zalo.me/..." />
        </div>
      </Card>

      <Card title="Câu hỏi thường gặp (FAQ)" desc="Hiển thị ở trang chủ + tạo rich result trên Google.">
        {faq.map((f, i) => (
          <div key={i} className="rounded-lg border border-cream-100 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-forest-700">Câu hỏi {i + 1}</span>
              <button onClick={() => up("faq", faq.filter((_, j) => j !== i))} className="text-xs font-medium text-red-600">Xoá</button>
            </div>
            <Field label="Câu hỏi" value={f.q ?? ""} onChange={(v) => up(`faq.${i}.q`, v)} />
            <div className="mt-2"><Field label="Trả lời" textarea value={f.a ?? ""} onChange={(v) => up(`faq.${i}.a`, v)} /></div>
          </div>
        ))}
        <button onClick={() => up("faq", [...faq, { q: "", a: "" }])} className="btn border border-cream-200 bg-white px-4 py-2 text-sm text-forest-800 hover:bg-cream-100">+ Thêm câu hỏi</button>
      </Card>

      {/* Sticky save */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-cream-200 bg-white/95 backdrop-blur">
        <div className="container-hk flex items-center justify-end gap-3 py-3">
          {msg && <span className="text-sm text-forest-700">{msg}</span>}
          <button onClick={save} disabled={saving} className="btn btn-gold px-6 py-2.5 text-sm">{saving ? "Đang lưu..." : "Lưu tất cả thay đổi"}</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── products manager ───────────────────────── */

type AdminProduct = {
  id?: string; slug: string; name: string; short_desc: string; description: string;
  status: string; images: string[]; meta_title: string; meta_description: string; price_vnd: number;
};

const emptyProduct: AdminProduct = {
  slug: "", name: "", short_desc: "", description: "", status: "active",
  images: [], meta_title: "", meta_description: "", price_vnd: 0,
};

const statusLabel: Record<string, string> = { active: "Hiển thị", draft: "Nháp", archived: "Ẩn" };
const statusColor: Record<string, string> = {
  active: "bg-forest-100 text-forest-700", draft: "bg-amber-100 text-amber-700", archived: "bg-cream-200 text-ink/50",
};

function ProductsManager({ token }: { token: string }) {
  const [list, setList] = useState<AdminProduct[]>([]);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    fetch(`${API_URL}/api/admin/products`, { headers: authHeaders(token) })
      .then((r) => r.json()).then((j) => setList(j.products ?? [])).catch(() => {});
  }, [token]);
  useEffect(reload, [reload]);

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.slug.trim()) { setMsg("Cần nhập Tên và Slug"); return; }
    setSaving(true); setMsg("");
    const isEdit = !!editing.id;
    try {
      const res = await fetch(`${API_URL}/api/admin/products${isEdit ? "/" + editing.id : ""}`, {
        method: isEdit ? "PUT" : "POST", headers: authHeaders(token), body: JSON.stringify(editing),
      });
      if (res.ok) { await triggerRevalidate(token); setEditing(null); setSlugTouched(false); setMsg("✓ Đã lưu sản phẩm"); reload(); }
      else { const j = await res.json().catch(() => ({})); setMsg("Lỗi: " + (j.message ?? res.status)); }
    } catch { setMsg("Lỗi kết nối"); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm("Xoá sản phẩm này?")) return;
    await fetch(`${API_URL}/api/admin/products/${id}`, { method: "DELETE", headers: authHeaders(token) });
    await triggerRevalidate(token);
    reload();
  };

  /* ----- form thêm/sửa ----- */
  if (editing) {
    const e = editing;
    const set = (k: keyof AdminProduct, v: any) => setEditing((p) => (p ? { ...p, [k]: v } : p));
    const onName = (v: string) => setEditing((p) => {
      if (!p) return p;
      const next = { ...p, name: v };
      if (!p.id && !slugTouched) next.slug = slugify(v);
      return next;
    });
    return (
      <div className="pb-24">
        <button onClick={() => { setEditing(null); setSlugTouched(false); }} className="mb-4 inline-flex items-center gap-1 text-sm text-ink/50 hover:text-forest-700">← Quay lại danh sách</button>
        <h2 className="mb-6 font-serif text-2xl font-bold text-forest-900">{e.id ? "Sửa sản phẩm" : "Thêm sản phẩm"}</h2>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card title="Thông tin cơ bản">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tên sản phẩm" value={e.name} onChange={onName} placeholder="VD: Cao Linh Chi Đỏ" />
                <label className="block">
                  <span className="f-label">Slug (đường dẫn)</span>
                  <input className="f-input" value={e.slug} placeholder="cao-linh-chi-do"
                    onChange={(ev) => { setSlugTouched(true); set("slug", slugify(ev.target.value)); }} />
                  <span className="f-help">URL: /san-pham/{e.slug || "..."}</span>
                </label>
              </div>
              <Field label="Mô tả ngắn" value={e.short_desc} onChange={(v) => set("short_desc", v)} placeholder="1–2 câu mô tả nổi bật" />
              <Field label="Mô tả chi tiết" textarea value={e.description} onChange={(v) => set("description", v)} placeholder="Thành phần, công dụng, cách dùng..." />
            </Card>

            <Card title="Hình ảnh" desc="Ảnh đầu tiên là ảnh đại diện.">
              <div className="flex flex-wrap items-center gap-3">
                {e.images.map((src, i) => (
                  <div key={i} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-20 w-20 rounded-lg border border-cream-200 object-cover" />
                    {i === 0 && <span className="absolute left-1 top-1 rounded bg-forest-800/90 px-1.5 py-0.5 text-[10px] text-cream-50">Đại diện</span>}
                    <button onClick={() => set("images", e.images.filter((_, j) => j !== i))}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-sm text-white shadow">×</button>
                  </div>
                ))}
              </div>
              <ImageUploader token={token} multiple onUploaded={(url) => setEditing((p) => (p ? { ...p, images: [...p.images, url] } : p))} />
            </Card>

            <Card title="SEO" desc="Tuỳ chọn — để trống sẽ tự dùng tên & mô tả ngắn.">
              <Field label="SEO title" value={e.meta_title} onChange={(v) => set("meta_title", v)} />
              <Field label="SEO description" textarea value={e.meta_description} onChange={(v) => set("meta_description", v)} />
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Giá & hiển thị">
              <Field label="Giá (VND)" type="number" value={String(e.price_vnd)} onChange={(v) => set("price_vnd", Number(v) || 0)} />
              <label className="block">
                <span className="f-label">Trạng thái</span>
                <select className="f-select" value={e.status} onChange={(ev) => set("status", ev.target.value)}>
                  <option value="active">Hiển thị</option>
                  <option value="draft">Nháp</option>
                  <option value="archived">Ẩn</option>
                </select>
              </label>
            </Card>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-cream-200 bg-white/95 backdrop-blur">
          <div className="container-hk flex items-center justify-end gap-3 py-3">
            {msg && <span className="text-sm text-forest-700">{msg}</span>}
            <button onClick={() => { setEditing(null); setSlugTouched(false); }} className="btn border border-cream-200 px-5 py-2.5 text-sm text-forest-800 hover:bg-cream-100">Huỷ</button>
            <button onClick={save} disabled={saving} className="btn btn-gold px-6 py-2.5 text-sm">{saving ? "Đang lưu..." : "Lưu sản phẩm"}</button>
          </div>
        </div>
      </div>
    );
  }

  /* ----- danh sách ----- */
  return (
    <div className="admin-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-100 p-4 sm:p-5">
        <div>
          <h2 className="font-serif text-lg font-semibold text-forest-900">Sản phẩm</h2>
          <p className="text-xs text-ink/45">{list.length} sản phẩm</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-sm text-forest-700">{msg}</span>}
          <button onClick={() => { setEditing({ ...emptyProduct }); setSlugTouched(false); }} className="btn btn-gold px-4 py-2 text-sm">+ Thêm sản phẩm</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-cream-100 bg-cream-50 text-left text-xs uppercase tracking-wide text-ink/45">
              <th className="px-4 py-3 font-semibold">Sản phẩm</th>
              <th className="px-4 py-3 font-semibold">Giá</th>
              <th className="px-4 py-3 font-semibold">Trạng thái</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-b border-cream-100 last:border-0 hover:bg-cream-50/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt="" className="h-11 w-11 rounded-lg border border-cream-200 object-cover" />
                    ) : <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-cream-100 text-[10px] font-semibold text-forest-400">HK</div>}
                    <div>
                      <div className="font-medium text-forest-900">{p.name}</div>
                      <div className="text-xs text-ink/40">/{p.slug}</div>
                    </div>
                  </div>
                </td>
                <td className="num px-4 py-3 font-semibold text-forest-800">{p.price_vnd.toLocaleString("vi-VN")}₫</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColor[p.status] ?? ""}`}>{statusLabel[p.status] ?? p.status}</span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => { setEditing({ ...emptyProduct, ...p }); setSlugTouched(true); }} className="mr-3 font-medium text-forest-700 hover:text-gold-600">Sửa</button>
                  <button onClick={() => p.id && del(p.id)} className="font-medium text-red-600 hover:text-red-700">Xoá</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={4} className="py-12 text-center text-ink/40">Chưa có sản phẩm. Bấm “+ Thêm sản phẩm”.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
