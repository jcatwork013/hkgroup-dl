-- 0004 ORDERS + PAYMENTS + ALLOCATIONS (T2/T3/T4)

CREATE TABLE orders (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code         TEXT NOT NULL UNIQUE,                 -- mã đơn hiển thị
    customer_id  UUID NOT NULL REFERENCES users(id),
    affiliate_id UUID NULL REFERENCES users(id),       -- last-click attribution (1 TẦNG)
    hub_id       UUID NULL,                            -- gán khi PAID (FK thêm ở 0007)
    region_code  TEXT NOT NULL DEFAULT '',             -- khu vực giao -> auto-gán hub
    status       TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN
                  ('CREATED','PAID','ASSIGNED','SHIPPING','COMPLETED','CANCELLED','REFUNDED')),
    subtotal_vnd BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_vnd >= 0),
    shipping_vnd BIGINT NOT NULL DEFAULT 0 CHECK (shipping_vnd >= 0),
    total_vnd    BIGINT NOT NULL DEFAULT 0 CHECK (total_vnd >= 0),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NULL
);
CREATE INDEX orders_customer_idx  ON orders (customer_id);
CREATE INDEX orders_affiliate_idx ON orders (affiliate_id);
CREATE INDEX orders_hub_idx       ON orders (hub_id);
CREATE INDEX orders_status_idx    ON orders (status);

CREATE TABLE order_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    variant_id     UUID NULL REFERENCES product_variants(id),
    product_name   TEXT NOT NULL,                         -- snapshot lúc đặt
    unit_price_vnd BIGINT NOT NULL CHECK (unit_price_vnd >= 0),
    qty            INT NOT NULL CHECK (qty > 0),
    line_total_vnd BIGINT NOT NULL CHECK (line_total_vnd >= 0)
);
CREATE INDEX order_items_order_idx ON order_items (order_id);

-- Thanh toán: payment_ref UNIQUE để webhook IDEMPOTENT (BẤT BIẾN #3).
CREATE TABLE payments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID NOT NULL REFERENCES orders(id),
    provider    TEXT NOT NULL CHECK (provider IN ('vnpay','momo','bank_transfer')),
    payment_ref TEXT NOT NULL,                            -- mã giao dịch từ cổng
    amount_vnd  BIGINT NOT NULL CHECK (amount_vnd >= 0),
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed')),
    raw         JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Khóa idempotent: 1 payment_ref/provider chỉ ghi 1 lần.
CREATE UNIQUE INDEX payments_ref_uniq ON payments (provider, payment_ref);
CREATE INDEX payments_order_idx ON payments (order_id);

-- Chốt phân bổ (T4): order_id PK = khóa idempotent tuyệt đối.
-- INSERT ... ON CONFLICT (order_id) DO NOTHING; nếu không insert được -> đã phân bổ rồi.
CREATE TABLE order_allocations (
    order_id            UUID PRIMARY KEY REFERENCES orders(id),
    total_vnd           BIGINT NOT NULL CHECK (total_vnd >= 0),
    affiliate_vnd       BIGINT NOT NULL DEFAULT 0,
    hub_vnd             BIGINT NOT NULL DEFAULT 0,
    community_vnd       BIGINT NOT NULL DEFAULT 0,
    shareholder_vnd     BIGINT NOT NULL DEFAULT 0,
    company_vnd         BIGINT NOT NULL DEFAULT 0,
    journal_id          UUID NOT NULL,
    allocated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    reversed_at         TIMESTAMPTZ NULL,                 -- set khi REFUNDED (bút toán đảo)
    reversal_journal_id UUID NULL,
    -- BẤT BIẾN #4 ở tầng DB: Σ phân bổ == total.
    CONSTRAINT order_allocations_sum_chk CHECK
        (affiliate_vnd + hub_vnd + community_vnd + shareholder_vnd + company_vnd = total_vnd)
);
