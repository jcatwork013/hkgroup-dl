// Logomark thương hiệu HKGROUP — emblem lá + wordmark. Dùng cho nav & footer (nền tối).
// Nếu admin upload logo riêng -> hiển thị ảnh đó (object-contain, không hộp nền).

type Brand = { name: string; logoUrl: string; tagline?: string };

export function BrandMark({
  brand,
  size = "md",
}: {
  brand: Brand;
  size?: "md" | "lg";
}) {
  const emblem = size === "lg" ? 40 : 34;
  const wordCls = size === "lg" ? "text-2xl" : "text-lg";

  if (brand.logoUrl) {
    // Logo upload bọc trong panel trắng bo góc -> hợp với mọi logo (kể cả nền trắng)
    // trên thanh nav nền tối: trông như "logo badge" tinh tế, to & rõ.
    const imgH = size === "lg" ? "h-12" : "h-11";
    const maxW = size === "lg" ? "max-w-[230px]" : "max-w-[200px]";
    return (
      <span className={`inline-flex items-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5 ${size === "lg" ? "px-3 py-2" : "px-2.5 py-1.5"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brand.logoUrl} alt={brand.name} className={`${imgH} ${maxW} w-auto object-contain`} />
      </span>
    );
  }

  // Tách "HK" + phần còn lại để tô 2 màu.
  const head = brand.name.slice(0, 2);
  const tail = brand.name.slice(2) || "";

  return (
    <span className="flex items-center gap-2.5">
      <span
        className="relative flex shrink-0 items-center justify-center rounded-xl"
        style={{
          width: emblem,
          height: emblem,
          background: "linear-gradient(145deg, #1f3d2a 0%, #102417 100%)",
          boxShadow: "inset 0 0 0 1px rgba(197,160,89,0.35)",
        }}
        aria-hidden
      >
        <svg width={emblem * 0.62} height={emblem * 0.62} viewBox="0 0 24 24" fill="none">
          {/* sprout / lá dược liệu */}
          <path d="M12 21V11" stroke="#c5a059" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M12 12c0-3 2.4-5.3 6-5.6-0.3 3.6-2.6 6-5.6 6" stroke="#d4b46b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 15c0-2.6-2-4.6-5.2-4.9 0.3 3.1 2.3 5.2 5 5.2" stroke="#a9863f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className={`font-serif ${wordCls} font-bold tracking-wide`}>
          <span className="text-cream-50">{head}</span>
          <span className="text-gold-500">{tail}</span>
        </span>
        <span className="mt-1 text-[9px] uppercase tracking-[0.3em] text-cream-100/40">
          {brand.tagline || "Dược liệu lên men"}
        </span>
      </span>
    </span>
  );
}
