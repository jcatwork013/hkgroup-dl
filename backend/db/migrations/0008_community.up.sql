-- 0008 COMMUNITY POOL (T8) — Quỹ Đồng Chia trả ĐIỂM cuối kỳ.

CREATE TABLE community_periods (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_key  TEXT NOT NULL UNIQUE,                 -- vd '2026-06' (1 kỳ = 1 tháng)
    pool_vnd    BIGINT NOT NULL DEFAULT 0,            -- Σ ledger community_pool trong kỳ
    distributed_vnd BIGINT NOT NULL DEFAULT 0,
    leftover_vnd    BIGINT NOT NULL DEFAULT 0,        -- phần dư carry kỳ sau
    status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
    closed_at   TIMESTAMPTZ NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chốt phân phối điểm: UNIQUE(period_id, customer_id) = khóa idempotent (BẤT BIẾN #3).
CREATE TABLE community_distributions (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    period_id   UUID NOT NULL REFERENCES community_periods(id),
    customer_id UUID NOT NULL REFERENCES users(id),
    sales_vnd   BIGINT NOT NULL,                      -- doanh số dùng làm trọng số
    points      BIGINT NOT NULL CHECK (points >= 0),  -- điểm phát ra
    journal_id  UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT community_dist_uniq UNIQUE (period_id, customer_id)
);
CREATE INDEX community_dist_customer_idx ON community_distributions (customer_id);
