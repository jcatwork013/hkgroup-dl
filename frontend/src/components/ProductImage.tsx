"use client";

import { useState } from "react";

// Ảnh sản phẩm với fallback: nếu URL ảnh 404/hỏng (vd file cũ đã mất) → hiện monogram "HK"
// thay vì icon ảnh vỡ. Giữ nguyên image_url từ admin invest, chỉ xử lý lỗi tải phía client.
export function ProductImage({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span className="flex h-full w-full items-center justify-center font-serif text-5xl text-forest-300/60">
        HK
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" className={className} onError={() => setBroken(true)} />
  );
}
