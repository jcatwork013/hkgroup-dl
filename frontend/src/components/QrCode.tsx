"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// QR sinh NGAY TRÊN MÁY KHÁCH (thư viện qrcode) — không gọi dịch vụ QR bên ngoài, nên link giới
// thiệu của CTV không bị lộ ra bên thứ ba. Một data-URL PNG dùng cho cả hiển thị và nút tải về.
export function useQrDataUrl(value: string, px = 640): { src: string; failed: boolean } {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    QRCode.toDataURL(value, {
      width: px, // sinh ảnh lớn: nét khi hiển thị nhỏ trên màn retina & khi in/quét từ ảnh
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#143021", light: "#ffffff" }, // xanh rêu thương hiệu trên nền trắng
    })
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [value, px]);

  return { src, failed };
}

// Ô QR vuông, viền kem — hiển thị ở kích thước `size`, ảnh gốc 640px.
export function QrCode({ src, size = 148, alt = "Mã QR" }: { src: string; size?: number; alt?: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-cream-200 bg-white p-1.5"
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- data-URL sinh tại client, không qua next/image
        <img src={src} alt={alt} width={size} height={size} className="h-full w-full" />
      ) : (
        <span className="text-[11px] text-ink/35">Đang tạo QR…</span>
      )}
    </span>
  );
}
