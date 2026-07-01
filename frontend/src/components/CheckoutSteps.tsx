// Chỉ báo bước mua hàng chuẩn ecommerce: Giỏ hàng → Thanh toán → Hoàn tất.
// Stepper cân đối, KHÔNG rớt hàng trên mobile: mỗi bước chiếm 1/3 chiều ngang,
// nhãn nằm dưới vòng tròn (được phép xuống dòng), đường nối co giãn lấp đầy.
export function CheckoutSteps({ active }: { active: 1 | 2 | 3 }) {
  const steps = ["Giỏ hàng", "Thông tin & Thanh toán", "Hoàn tất"];
  return (
    <ol className="mb-8 flex items-start">
      {steps.map((s, i) => {
        const n = i + 1;
        const done = n < active;
        const cur = n === active;
        const first = i === 0;
        const last = i === steps.length - 1;
        return (
          <li key={s} className="flex flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              {/* Đường nối trái: sáng khi đã tới bước này */}
              <span className={`h-0.5 flex-1 rounded-full ${first ? "invisible" : n <= active ? "bg-forest-800" : "bg-cream-200"}`} />
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  cur || done ? "bg-forest-800 text-gold-300" : "bg-cream-200 text-ink/40"
                }`}
              >
                {done ? "✓" : n}
              </span>
              {/* Đường nối phải: sáng khi đã vượt qua bước này */}
              <span className={`h-0.5 flex-1 rounded-full ${last ? "invisible" : n < active ? "bg-forest-800" : "bg-cream-200"}`} />
            </div>
            <span
              className={`mt-2 px-0.5 text-[11px] leading-tight sm:text-sm ${
                cur ? "font-semibold text-forest-900" : done ? "text-forest-700" : "text-ink/45"
              }`}
            >
              {s}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
