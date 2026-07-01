// Gọi API đặt hàng công khai (checkout) tới API duy nhất api.duoclieuhk.vn.
const INVEST = process.env.NEXT_PUBLIC_INVEST_API_URL ?? "http://localhost:8080";

export type CheckoutBank = {
  bank_name: string;
  bank_code: string;
  account: string;
  account_name: string;
};
export type CheckoutResult = {
  code: string;
  subtotal_vnd: number;
  status: string;
  bank: CheckoutBank;
};
export type CheckoutInput = {
  customer_name: string;
  customer_phone: string;
  address: string;
  email: string;
  note: string;
  ref_code: string;
  items: { product_id: string; qty: number }[];
};

export async function submitCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const res = await fetch(`${INVEST}/api/v1/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let msg = "Đặt hàng thất bại. Vui lòng thử lại.";
    try {
      const e = (await res.json()) as { error?: string };
      if (e.error) msg = e.error;
    } catch {
      /* giữ message mặc định */
    }
    throw new Error(msg);
  }
  return (await res.json()) as CheckoutResult;
}
