-- 0005 AFFILIATE (T5) — ĐÚNG 1 TẦNG (không F2/F3). Hoa hồng đọc từ ledger.

CREATE TABLE affiliate_profiles (
    user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    ref_code    TEXT NOT NULL UNIQUE,                  -- mã giới thiệu hiển thị
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tracking lượt click vào link affiliate.
CREATE TABLE affiliate_clicks (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ref_code     TEXT NOT NULL,
    landing_path TEXT NOT NULL DEFAULT '/',
    visitor_id   TEXT NOT NULL DEFAULT '',             -- cookie/anon id
    ip           INET NULL,
    user_agent   TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX affiliate_clicks_ref_idx ON affiliate_clicks (ref_code, created_at);

-- Attribution last-click có TTL. Mỗi customer giữ bản ghi mới nhất còn hạn.
CREATE TABLE affiliate_attributions (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    affiliate_id UUID NOT NULL REFERENCES users(id),
    ref_code     TEXT NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX affiliate_attributions_customer_idx ON affiliate_attributions (customer_id, created_at DESC);
