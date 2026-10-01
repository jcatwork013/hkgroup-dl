"use client";

import { useEffect, useRef, useState } from "react";

// Đoạn văn dài (vd mô tả ngắn 400+ ký tự) → gọn trong N dòng, có nút "Xem thêm".
// Chỉ hiện nút khi chữ thực sự bị cắt.
export function ExpandableText({ text, lines = 4, className = "" }: { text: string; lines?: number; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setClipped(el.scrollHeight > el.clientHeight + 2);
  }, [text]);

  return (
    <div className={className}>
      <p
        ref={ref}
        style={open ? undefined : { WebkitLineClamp: lines, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden" }}
        className="whitespace-pre-line text-[15px] leading-relaxed text-ink/65"
      >
        {text}
      </p>
      {(clipped || open) && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-1.5 text-sm font-medium text-forest-700 underline-offset-4 hover:underline"
        >
          {open ? "Thu gọn" : "Xem thêm"}
        </button>
      )}
    </div>
  );
}
