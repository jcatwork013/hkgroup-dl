-- 0003 CATALOG (T2) — sản phẩm dược liệu, biến thể, giá BIGINT VND.
-- slug + meta_* phục vụ SEO (FE render server-side).

CREATE TABLE categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug       TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    parent_id  UUID NULL REFERENCES categories(id),
    sort_order INT  NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug             TEXT NOT NULL UNIQUE,           -- SEO-friendly URL
    name             TEXT NOT NULL,
    short_desc       TEXT NOT NULL DEFAULT '',
    description      TEXT NOT NULL DEFAULT '',       -- markdown/html
    category_id      UUID NULL REFERENCES categories(id),
    status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
    images           JSONB NOT NULL DEFAULT '[]',
    meta_title       TEXT NOT NULL DEFAULT '',       -- SEO
    meta_description TEXT NOT NULL DEFAULT '',       -- SEO
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_status_idx   ON products (status);
CREATE INDEX products_category_idx ON products (category_id);

CREATE TABLE product_variants (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku        TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL DEFAULT '',
    price_vnd  BIGINT NOT NULL CHECK (price_vnd >= 0),  -- BẤT BIẾN #1: BIGINT, không float
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX product_variants_product_idx ON product_variants (product_id);
