import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

// Admin gọi sau khi lưu để làm mới ISR cache trang public NGAY (không đợi ~30s).
// Bảo vệ: chỉ chấp nhận JWT admin hợp lệ — xác thực lại với backend qua mạng nội bộ docker.
const SERVER_API_URL =
  process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8090";

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    // Endpoint admin-only của backend: 200 ⇒ token là admin hợp lệ.
    const check = await fetch(`${SERVER_API_URL}/api/admin/products`, {
      headers: { Authorization: auth },
      cache: "no-store",
    });
    if (!check.ok) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "validate_failed" }, { status: 502 });
  }

  // Settings ảnh hưởng layout (Navbar/Footer/metadata) trên MỌI trang ⇒ revalidate cả cây.
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, revalidated: true });
}
