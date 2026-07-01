# 0009 — Shareholder Investor Schema · ⛔ GATED (chưa build)

Theo **GATE PHÁP LÝ** trong `CLAUDE.md`:

> KHÔNG build Shareholder Pool / cam kết hoàn vốn 115% / huy động vốn công chúng
> khi CHƯA có xác nhận pháp lý.

Vì vậy các bảng sau **CỐ Ý CHƯA TẠO** (không có file `.up.sql`/`.down.sql` để migrate runner bỏ qua):

- `investors` — hồ sơ nhà đầu tư, vốn góp, target 115%, trạng thái ACTIVE/COMPLETED.
- `shareholder_allocations` — chốt phân bổ, `UNIQUE(source_order_id, investor_id)` (idempotent).

**Hiện trạng hợp lệ:** Allocation Engine (T4) CHỈ ghi 15% vào ví hệ thống
`wallets(kind='shareholder_pool')` (đã tạo ở `0001`) — coi như một ví tích luỹ.
Không có dòng tiền nào chảy tới investor cho đến khi T9 được mở khoá.

**Khi nào build:** chỉ khi chủ dự án xác nhận bằng văn bản đã có ý kiến pháp lý cho phép.
Lúc đó tạo `0009_shareholder.up.sql` + engine, và phải chốt trước 2 điểm spec còn trống:
1. Phân bổ theo *remaining* / theo *vốn góp* / *chia đều*?
2. Leftover do làm tròn/cap → *carry kỳ sau* hay *về company*?
