# HKGROUP 🌿

Hệ thống 2 web, **1 tổ chức** (không multi-tenant):

- **HK SHOP** — ecommerce dược liệu, tạo doanh thu, có **affiliate 1 tầng** + mạng **hub nhượng quyền** theo khu vực.
- **HK SHAREHOLDER** — portal nhà đầu tư nhận doanh thu để phân bổ Pool. **(Tầng B — GATED, chưa build.)**

> Tài chính được xây trên **sổ kép (double-entry ledger)**, tiền là **BIGINT đồng VND**, mọi dịch chuyển **idempotent + nguyên tử**. Xem `CLAUDE.md` cho 8 bất biến tiền & GATE pháp lý.

## Tech stack
- **Backend**: Go 1.22 · Chi · pgx/v5 · sqlc · NATS JetStream
- **DB**: PostgreSQL 16 (ledger kép, trigger append-only, partial unique index)
- **Frontend**: Next.js 15 (App Router, RSC) · Tailwind v4 · SEO tối đa
- **Hạ tầng**: Docker Compose (Postgres + Redis + NATS)

## Cấu trúc
```
HKGroup/
├── CLAUDE.md                  # 8 bất biến tiền + GATE pháp lý (đọc trước khi code)
├── docker-compose.yml         # postgres:5441 · redis · nats:4232
├── Makefile                   # up/migrate/test/grep-float/...
├── backend/
│   ├── cmd/{api,worker,migrate}/   # HTTP server · NATS consumer · migration runner
│   ├── internal/
│   │   ├── money/             # kiểu VND (BIGINT), floor, MulDivFloor (big.Int, không tràn)
│   │   ├── ledger/            # SỔ KÉP: Journal, Validate (Σ=0), PostJournal, Balance, Reversed
│   │   ├── allocation/        # ⭐ T4 Allocation Engine (idempotent + reversal)
│   │   ├── order/             # T3 state machine + T2 service (webhook idempotent, gán hub)
│   │   ├── withdrawal/        # T6 rút ví hoa hồng (cửa sổ 15–30, khóa số dư)
│   │   ├── community/         # T8 Quỹ Đồng Chia (trả ĐIỂM, idempotent theo kỳ)
│   │   ├── auth/              # T1 JWT + RBAC + row-level
│   │   ├── api/              # Chi router + handlers
│   │   ├── store/            # sqlc generated
│   │   └── platform/{db,events,httpx}/
│   └── db/{migrations,queries}/
└── frontend/                  # Next.js (hero, catalog, product, affiliate dashboard, sitemap/robots)
```

## Chạy nhanh
```bash
cp .env.example .env
make up               # bật postgres + redis + nats (docker)
make migrate-up       # tạo schema (ledger, orders, ...)
make api              # HTTP API :8090
make worker           # NATS consumer (allocation engine)
make web              # Next.js :3000
```

## Test & chất lượng
```bash
make test-money       # core tiền (không cần DB): money/ledger/allocation/order/withdrawal/community
make test-integration # cần Postgres: idempotency + concurrency + reversal
make grep-float       # BẤT BIẾN #1: chặn float trên đường đi của tiền
make sqlc             # generate store từ db/queries
```

### Bằng chứng đã chạy
- `Allocate` invariant `Σ phân bổ == gốc` qua **100.000+** case ngẫu nhiên.
- Engine **idempotent**: chạy 2 lần / **100 goroutine song song** cùng order → đúng **1** lần phân bổ, không double-post.
- **Reversal** khi REFUNDED: ví affiliate về 0, entry cũ KHÔNG bị xóa (append-only).
- E2E qua API + NATS: webhook x2 (idempotent) → COMPLETED → worker phân bổ `aff10% comm5% share15% company=remainder`.
- Migration **up/down** reversible 100%.

## Trạng thái build
| Task | Mô tả | Trạng thái |
|---|---|---|
| T0 | Ledger kép + post-balanced-journal | ✅ + test |
| T1 | Auth & RBAC | ✅ (register/login/JWT/middleware) |
| T2 | Catalog + checkout + payment webhook (idempotent) | ✅ |
| T3 | Order state machine + auto-gán hub | ✅ + test |
| T4 | **Allocation Engine** (idempotent + reversal) | ✅ + invariant/concurrency test |
| T5 | Affiliate dashboard | ✅ (UI + số dư từ ledger) |
| T6 | Withdrawal (cửa sổ 15–30) | ✅ + test biên |
| T7 | Hub & Inventory (level theo lũy kế, tồn kho không âm) | ✅ + test biên ngưỡng |
| T8 | Community Pool (điểm) | ✅ + idempotency test |
| **T9** | Shareholder Pool Engine | ⛔ **GATED** (chỉ ghi ví shareholder_pool) |
| **T10** | Referral F1/F2/F3 | ⛔ **GATED — mặc định BỎ** |

## Spec đã chốt ✓ / còn lại
- ✅ **Hub level**: L1 <50tr · L2 [50tr,100tr) · L3 ≥100tr (rate 15/20/25%).
- ✅ **Community Pool**: doanh số tính **theo KỲ** (per_period).
- ⏳ **Shareholder** (T9, **GATED**): phân bổ theo remaining / vốn góp / chia đều? leftover carry hay về company? — chốt khi mở GATE pháp lý.

## 🚧 GATE pháp lý
T9/T10 **KHÔNG build** khi chưa có xác nhận pháp lý bằng văn bản. Allocation Engine chỉ ghi 15% vào ví hệ thống `shareholder_pool` — không dòng tiền nào tới investor.
