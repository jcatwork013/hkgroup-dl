# HKGROUP — Context cho repo

> Repo này tuân thủ CLAUDE.md global (Go 1.22 Chi + sqlc + pgx · PostgreSQL 16 · Redis · NATS JetStream · Next.js App Router + shadcn/ui). File này **bổ sung nghiệp vụ tiền + rào chắn pháp lý** cho riêng repo HKGROUP. Đọc kỹ và tuân thủ tuyệt đối.

## Bối cảnh
Hệ thống 2 web, **1 tổ chức** (không multi-tenant; phân quyền theo role + row-level theo owner):
- **HK SHOP**: ecommerce dược liệu, tạo doanh thu, có affiliate (**1 TẦNG**) + mạng hub nhượng quyền theo khu vực.
- **HK SHAREHOLDER**: portal nhà đầu tư, nhận dữ liệu doanh thu từ Shop để phân bổ Pool. (**Tầng B — xem GATE**.)

Mỗi đơn `COMPLETED` phân bổ: Affiliate 10% · Hub 15/20/25% theo level · Quỹ Đồng Chia 5% (trả **ĐIỂM**) · Shareholder Pool 15% · HKGroup phần còn lại.

## 8 BẤT BIẾN TIỀN (MUST — vi phạm là bug nghiêm trọng)
1. Tiền lưu **BIGINT đơn vị đồng (VND)**. TUYỆT ĐỐI không float/decimal trên đường đi của tiền.
2. Mọi số dư đến từ **SỔ KÉP** (double-entry ledger): số dư = `SUM(ledger_entries)`, mỗi giao dịch sinh các entry **CÂN BẰNG** (Σ debit = Σ credit). KHÔNG lưu cột balance cache rồi cộng/trừ tay.
3. Mọi dịch chuyển tiền **IDEMPOTENT**: khóa nghiệp vụ (`order_id`, `source_order_id`, `period_id`, `payment_ref`…) + **UNIQUE constraint ở DB**. Retry/webhook KHÔNG được tính 2 lần.
4. Làm tròn bằng **floor**; phần dư gom về **ví COMPANY**. Bất biến: `Σ phân bổ == gốc` (lệch 1 đồng = bug).
5. Đổi trạng thái qua **STATE MACHINE** đã định nghĩa, trong **1 DB transaction**. Không UPDATE status tùy tiện.
6. Refund/hủy sau khi đã phân bổ → ghi **BÚT TOÁN ĐẢO** (reversal). KHÔNG xóa/sửa entry cũ.
7. Validate điều kiện ở **SERVER** (cửa sổ rút 15–30, ngưỡng eligible…). Không tin client.
8. Mọi thay đổi tiền/trạng thái ghi **audit_log bất biến**.

## Quy ước
- Sự kiện NATS: `order.completed`, `order.allocated`, `community.period.closed`, `shareholder.allocate`.
- Bảng chốt idempotent: `order_allocations(order_id PK)`, `shareholder_allocations UNIQUE(source_order_id, investor_id)`, `community_distributions UNIQUE(period_id, customer_id)`.
- Ledger `wallets.kind ∈ {commission, point, investor, referral, company, community_pool, shareholder_pool}`.

## GATE PHÁP LÝ (MUST NOT — không build khi chưa có chữ ký pháp lý)
- KHÔNG build **Shareholder Pool / cam kết hoàn vốn 115% / huy động vốn công chúng** khi chưa có xác nhận pháp lý. (T9 = GATED)
- KHÔNG build **Referral đa tầng F1/F2/F3** cho nhà đầu tư (đa cấp phi hàng hóa, rủi ro cao — mặc định **BỎ**). (T10 = GATED)
- Affiliate Shop giữ **ĐÚNG 1 TẦNG** (không F2/F3). Quỹ Đồng Chia trả bằng **ĐIỂM**, không tiền mặt (điểm chỉ đổi sản phẩm/thanh toán đơn).
- Nếu một task yêu cầu vượt GATE: **DỪNG và hỏi lại**, đừng tự ý implement.

## SPEC CÒN TRỐNG — PHẢI HỎI, KHÔNG TỰ ĐOÁN
- Rate hub cho khoảng nhập **50tr–100tr** (spec bỏ trống). → T7
- Community Pool: "doanh số" tính theo **KỲ** hay **LŨY KẾ**? → T8
- Shareholder: phân bổ theo remaining / theo vốn góp / chia đều? leftover do làm tròn → carry hay về company? → T9
Gặp các điểm này: liệt kê 2–3 phương án + đánh đổi rồi hỏi, **không tự suy diễn**.

## DEFINITION OF DONE (mọi task liên quan tiền)
- [ ] Unit test + ít nhất 1 property/invariant test: `Σ phân bổ == gốc`; chạy 2 lần không double-count.
- [ ] Test concurrency cho phần có race (allocation/pool/withdrawal).
- [ ] Migration thuận + nghịch (up/down). Query qua **sqlc**.
- [ ] Không có float ở đường đi của tiền (`make grep-float` chặn).
- [ ] Lỗi trả về có mã rõ ràng; thao tác tiền nằm trong **1 transaction**.

## Tình trạng build (cập nhật khi tiến)
- [x] T0 Bootstrap + ledger kép + post-balanced-journal
- [x] T1 Auth/RBAC (JWT + middleware + row-level)
- [x] T2 Catalog + checkout + payment webhook (idempotent)
- [x] T3 Order state machine + auto-gán hub
- [x] T4 Allocation Engine (math + idempotent + reversal) — invariant/concurrency test
- [x] T5 Affiliate dashboard (số dư từ ledger)
- [x] T6 Withdrawal state machine + window 15–30
- [x] T7 Hub & Inventory — level theo lũy kế (ĐÃ CHỐT L1<50tr·L2[50,100)tr·L3≥100tr), tồn kho không âm
- [x] T8 Community Pool job (points) — ĐÃ CHỐT basis = theo KỲ
- [ ] T9/T10 — **GATED**, không build

## Quyết định spec đã chốt
- Community Pool "doanh số" = **theo KỲ** (per_period).
- Hub level theo lũy kế nhập: **L1 <50tr · L2 [50tr,100tr) · L3 ≥100tr** (rate 15/20/25%).

## CÔNG TẮC TẠM ĐÓNG TOÀN HỆ THỐNG (vận hành)
Chặn ở **nginx**, một cờ cho TẤT CẢ domain duoclieuhk: `duoclieuhk.vn` · `www` ·
`invest` · `admin` · `api` · `api-web`.

```bash
sudo ./deploy/hk-site.sh close      # ĐÓNG hết  (make site-close)
sudo ./deploy/hk-site.sh open       # MỞ lại    (make site-open)
./deploy/hk-site.sh status          # đang đóng hay mở (make site-status)
sudo ./deploy/hk-site.sh install    # cài/cập nhật config nginx (đã chạy 1 lần)
```

- **Cờ = file `/etc/nginx/flags/duoclieuhk.closed`** — tạo/xoá là ăn NGAY, không reload
  nginx, không rebuild image, **không dừng container** → DB/đơn hàng/ledger nguyên vẹn,
  mở lại là chạy tiếp.
- Khi đóng: mọi URL trả **503 + `Retry-After`** (KHÔNG phải 404/200) → Google hiểu là tạm
  thời, không rớt index. Web/admin trả trang HTML tạm đóng, `api*` trả JSON
  `{"error":"service_closed"}`. `/.well-known/acme-challenge/` vẫn mở để gia hạn SSL.
- **Xem trước khi đang đóng** (nội bộ): mở URL kèm `?mo_cua=<KEY>` → nginx set cookie 12h.
  KEY nằm ở `/etc/nginx/conf.d/duoclieuhk-closed.conf` (**không commit**; đổi KEY phải
  `nginx -t && systemctl reload nginx`).
- Nguồn config trong repo: `deploy/hk-site.sh` · `deploy/nginx/duoclieuhk-closed.conf` ·
  `deploy/nginx/snippet-duoclieuhk-closed*.conf` · `deploy/closed-page/*.tpl`.
  Mỗi vhost 443 include snippet ngay sau `client_max_body_size`.
- Đổi nội dung trang tạm đóng: `close --title/--msg/--until/--hotline/--email`, hoặc sửa
  template rồi chạy lại `close`.

## VẬN HÀNH — BACKUP & WATCHDOG (dựng 06/09/2026)

**Backup HKGROUP** — `/root/scripts/hkgroup-backup.sh`, cron 2h sáng (giờ VN).
DB (`pg_dump -Fc`, tự verify đọc được ≥20 bảng) + volume `hkgroup_uploaddata`,
giữ 30 ngày ở `/root/backups/hkgroup/`, bản mới nhất là `latest-db.dump.gz` /
`latest-uploads.tar.gz`. Thất bại → báo Telegram. Xem cách khôi phục:
`/root/scripts/hkgroup-backup.sh --restore-help`.

**Watchdog toàn VPS** — `/root/scripts/docker-watchdog.sh`, cron mỗi 5 phút + `@reboot`.
Danh sách kỳ vọng ở `/root/.config/watchdog/expected.conf` (64 container + 64 URL).
Container dừng → **tự `docker start`**; URL trả 5xx → báo Telegram (báo 1 lần khi hỏng,
1 lần khi hồi phục, nhắc lại mỗi 6h). Biết cờ tạm đóng: nếu
`/etc/nginx/flags/duoclieuhk.closed` tồn tại thì kỳ vọng duoclieuhk = 503, không báo động giả.
Thêm/bớt: sửa file trên, hoặc `docker-watchdog.sh --seed` để sinh lại từ hiện trạng.
Xem không sửa gì: `--status`.

## Cổ tức: quy tắc làm tròn (chốt 06/09/2026)
`planDividendAmounts` trong `/root/hkgroup/backend/internal/service/dividend.go` chia bằng
**SỐ NGUYÊN** (big.Int, không float — BẤT BIẾN #1), phần dư do làm tròn dồn cho **cổ đông lớn
nhất** nên `Σ payout == total` tuyệt đối (BẤT BIẾN #4). Cổ đông được sắp `shares DESC, user_id`
trước khi chia vì `ListAllShareholdings` không có ORDER BY — không sắp thì người nhận phần dư
đổi mỗi lần chạy. Test: `backend/internal/service/dividend_alloc_test.go`.

> **Lệch 4đ lịch sử — KHÔNG phải bug mới.** 3 đợt cổ tức tháng 6/2026
> (`5c4dfeec…` dư 2đ, `0fd41267…` dư 1đ, `b9ca5aaa…` dư 1đ) được chia bằng code float cũ nên
> `Σ dividend_payouts` thiếu 4đ so với `Σ dividends`. Tiền đã trả xong; **giữ nguyên theo quyết
> định 06/09/2026** để sổ sách khớp tiền thật đã chuyển. Từ đợt mới trở đi lệch = 0.
