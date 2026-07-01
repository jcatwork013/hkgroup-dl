-- 0007 HUB & INVENTORY (T7) — nhượng quyền theo khu vực, level theo lũy kế nhập.
-- LƯU Ý: ngưỡng level cho khoảng 50tr–100tr SPEC BỎ TRỐNG -> chỉ lưu level dạng cột,
-- ánh xạ ngưỡng->level làm ở tầng cấu hình SAU KHI hỏi rõ. Không hardcode ở DB.

CREATE TABLE regions (
    code        TEXT PRIMARY KEY,                 -- vd 'HN', 'HCM', 'DN'
    name        TEXT NOT NULL,
    parent_code TEXT NULL REFERENCES regions(code)
);

CREATE TABLE hubs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id           UUID NOT NULL REFERENCES users(id),
    region_code             TEXT NOT NULL REFERENCES regions(code),
    level                   INT  NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 3),
    status                  TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
    cumulative_purchase_vnd BIGINT NOT NULL DEFAULT 0 CHECK (cumulative_purchase_vnd >= 0),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hubs_region_idx ON hubs (region_code);
-- 1 region 1 hub active (mạng nhượng quyền theo khu vực). Điều chỉnh nếu cho nhiều hub/region.
CREATE UNIQUE INDEX hubs_active_per_region ON hubs (region_code) WHERE status = 'active';

-- Bây giờ mới gắn được FK orders.hub_id -> hubs.id.
ALTER TABLE orders
    ADD CONSTRAINT orders_hub_fk FOREIGN KEY (hub_id) REFERENCES hubs(id);

-- Tồn kho theo hub. qty không âm.
CREATE TABLE hub_inventory (
    hub_id     UUID NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES product_variants(id),
    qty        INT  NOT NULL DEFAULT 0 CHECK (qty >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (hub_id, variant_id)
);

-- Lịch sử nhập hàng từ HKGroup -> cộng lũy kế tính level.
CREATE TABLE hub_purchases (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hub_id     UUID NOT NULL REFERENCES hubs(id),
    amount_vnd BIGINT NOT NULL CHECK (amount_vnd > 0),
    note       TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hub_purchases_hub_idx ON hub_purchases (hub_id);
