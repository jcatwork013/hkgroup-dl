"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Bộ sưu tập ảnh/video trang chi tiết sản phẩm + lightbox xem toàn màn hình.
// Thứ tự: ảnh đại diện → video (nếu có) → các ảnh còn lại. Không thêm thư viện ngoài.

type Media = { kind: "image" | "video"; src: string };

function buildMedia(images: string[], video?: string): Media[] {
  const m: Media[] = images.map((src) => ({ kind: "image", src }));
  if (video) m.splice(Math.min(1, m.length), 0, { kind: "video", src: video });
  return m;
}

// Vuốt ngang trên mobile → chuyển ảnh. Bỏ qua khi người dùng đang cuộn dọc.
function useSwipe(onPrev: () => void, onNext: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0]!;
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const t = e.changedTouches[0]!;
      const dx = t.clientX - s.x;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(t.clientY - s.y)) return;
      if (dx > 0) onPrev();
      else onNext();
    },
  };
}

function PlayBadge({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 w-7" : "h-14 w-14";
  const icon = size === "sm" ? "h-3 w-3" : "h-6 w-6";
  return (
    <span className={`flex ${box} items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/30 backdrop-blur-sm`}>
      <svg viewBox="0 0 24 24" className={`${icon} translate-x-[1px]`} fill="currentColor" aria-hidden>
        <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
      </svg>
    </span>
  );
}

function Arrow({ dir, onClick, className = "" }: { dir: "prev" | "next"; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label={dir === "prev" ? "Ảnh trước" : "Ảnh sau"}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-forest-900 shadow-md backdrop-blur transition hover:bg-white ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
        <path d={dir === "prev" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function Fallback() {
  return (
    <span className="flex h-full w-full items-center justify-center font-serif text-5xl text-forest-300/60">HK</span>
  );
}

export function ProductGallery({ images, video, name }: { images: string[]; video?: string; name: string }) {
  const media = buildMedia(images, video);
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const stripRef = useRef<HTMLDivElement>(null);
  const n = media.length;

  const go = useCallback((i: number) => setIdx(((i % n) + n) % n), [n]);
  const swipe = useSwipe(() => go(idx - 1), () => go(idx + 1));

  // Giữ thumbnail đang chọn trong vùng nhìn thấy — chỉ cuộn NGANG dải thumbnail.
  // (scrollIntoView cuộn cả trang theo chiều dọc → trang bị giật/nhảy khi tải và khi đổi ảnh.)
  useEffect(() => {
    const strip = stripRef.current;
    const el = strip?.children[idx] as HTMLElement | undefined;
    if (!strip || !el) return;
    const left = el.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + el.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: left - (strip.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
    }
  }, [idx]);

  if (n === 0) {
    return (
      <div className="aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-forest-100 to-cream-100">
        <Fallback />
      </div>
    );
  }

  const cur = media[idx]!;
  const poster = images[0];

  return (
    <div className="lg:sticky lg:top-24">
      <div
        className="group relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-forest-100 to-cream-100 ring-1 ring-forest-900/5"
        {...swipe}
      >
        {cur.kind === "video" ? (
          <video
            key={cur.src}
            src={cur.src}
            poster={poster}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full bg-black object-contain"
          />
        ) : broken[cur.src] ? (
          <Fallback />
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="block h-full w-full cursor-zoom-in"
            aria-label="Phóng to ảnh"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={cur.src}
              src={cur.src}
              alt={idx === 0 ? name : `${name} – ảnh ${idx + 1}`}
              fetchPriority={idx === 0 ? "high" : undefined}
              onError={() => setBroken((b) => ({ ...b, [cur.src]: true }))}
              className="h-full w-full animate-[hkfade_.25s_ease] object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </button>
        )}

        {n > 1 && (
          <>
            <Arrow dir="prev" onClick={() => go(idx - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 max-sm:hidden" />
            <Arrow dir="next" onClick={() => go(idx + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 max-sm:hidden" />
            <span className="num pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {idx + 1} / {n}
            </span>
          </>
        )}
        {cur.kind === "image" && !broken[cur.src] && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Xem toàn màn hình"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-forest-900 shadow-sm backdrop-blur transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      {n > 1 && (
        <div ref={stripRef} className="-mx-1 mt-4 flex snap-x scroll-px-1 gap-2.5 overflow-x-auto p-1 pb-2 [scrollbar-width:thin]">
          {media.map((m, i) => (
            <button
              key={m.src}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={m.kind === "video" ? "Xem video" : `Ảnh ${i + 1}`}
              aria-current={i === idx}
              className={`relative aspect-square w-[72px] shrink-0 snap-start overflow-hidden rounded-xl bg-gradient-to-br from-forest-100 to-cream-100 ring-2 transition sm:w-20 ${
                i === idx ? "ring-forest-700" : "ring-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {m.kind === "video" ? (
                <>
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={poster} alt="" className="h-full w-full object-cover brightness-75" />
                  ) : (
                    <span className="block h-full w-full bg-forest-900" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <PlayBadge size="sm" />
                  </span>
                </>
              ) : broken[m.src] ? (
                <span className="flex h-full w-full items-center justify-center font-serif text-lg text-forest-300/60">HK</span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.src}
                  alt=""
                  loading="lazy"
                  onError={() => setBroken((b) => ({ ...b, [m.src]: true }))}
                  className="h-full w-full object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}

      {open && <Lightbox media={media} start={idx} name={name} onClose={(i) => { setIdx(i); setOpen(false); }} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// Lightbox toàn màn hình: ← → / Esc, vuốt trên mobile, nhấn ảnh để phóng to 2.5× (di chuột
// để soi chi tiết), dải thumbnail phía dưới, khoá cuộn trang khi mở.
function Lightbox({
  media,
  start,
  name,
  onClose,
}: {
  media: Media[];
  start: number;
  name: string;
  onClose: (idx: number) => void;
}) {
  const [i, setI] = useState(start);
  const [zoom, setZoom] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const n = media.length;
  const go = useCallback(
    (to: number) => {
      setZoom(false);
      setI(((to % n) + n) % n);
    },
    [n],
  );
  const close = useCallback(() => onClose(i), [onClose, i]);
  const swipe = useSwipe(() => !zoom && go(i - 1), () => !zoom && go(i + 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") go(i - 1);
      else if (e.key === "ArrowRight") go(i + 1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close, go, i]);

  const m = media[i]!;
  const poster = media.find((x) => x.kind === "image")?.src;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ảnh sản phẩm ${name}`}
      className="fixed inset-0 z-[100] flex animate-[hkfade_.2s_ease] flex-col bg-forest-950/95"
      onClick={close}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white/80 sm:px-6" onClick={(e) => e.stopPropagation()}>
        <span className="num text-sm">
          {i + 1} / {n}
          <span className="ml-3 hidden text-white/50 sm:inline">{name}</span>
        </span>
        <button
          type="button"
          onClick={close}
          aria-label="Đóng"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-20" {...swipe}>
        {m.kind === "video" ? (
          <video
            key={m.src}
            src={m.src}
            poster={poster}
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg bg-black shadow-2xl"
          />
        ) : (
          <div
            className={`relative max-h-full max-w-full overflow-hidden rounded-lg ${zoom ? "cursor-zoom-out" : "cursor-zoom-in"}`}
            onClick={(e) => {
              e.stopPropagation();
              setZoom((z) => !z);
            }}
            onMouseMove={(e) => {
              // Ghi thẳng vào style (không setState) → không re-render cả lightbox mỗi lần rê chuột.
              const img = imgRef.current;
              if (!zoom || !img) return;
              const r = e.currentTarget.getBoundingClientRect();
              img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              key={m.src}
              src={m.src}
              alt={`${name} – ảnh ${i + 1}`}
              className={`block max-h-[calc(100dvh-11rem)] max-w-full select-none object-contain shadow-2xl transition-transform duration-300 ${
                zoom ? "scale-[2.5]" : "scale-100"
              }`}
              draggable={false}
            />
          </div>
        )}

        {n > 1 && (
          <>
            <Arrow dir="prev" onClick={() => go(i - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 max-sm:hidden sm:left-6" />
            <Arrow dir="next" onClick={() => go(i + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 max-sm:hidden sm:right-6" />
          </>
        )}
      </div>

      {n > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 py-4" onClick={(e) => e.stopPropagation()}>
          {media.map((x, k) => (
            <button
              key={x.src}
              type="button"
              onClick={() => go(k)}
              aria-label={x.kind === "video" ? "Video" : `Ảnh ${k + 1}`}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-2 transition ${
                k === i ? "ring-gold-400" : "ring-transparent opacity-50 hover:opacity-90"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {x.kind === "image" ? <img src={x.src} alt="" className="h-full w-full object-cover" /> : poster ? <img src={poster} alt="" className="h-full w-full object-cover brightness-75" /> : <span className="block h-full w-full bg-black" />}
              {x.kind === "video" && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <PlayBadge size="sm" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <p className="pb-3 text-center text-xs text-white/40 max-sm:hidden">Nhấn ảnh để phóng to · ← → để chuyển · Esc để đóng</p>
    </div>,
    document.body,
  );
}
