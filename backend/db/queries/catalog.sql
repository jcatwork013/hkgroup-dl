-- name: ListActiveProducts :many
SELECT p.id, p.slug, p.name, p.short_desc, p.meta_title, p.meta_description,
       COALESCE(MIN(pv.price_vnd), 0)::bigint AS min_price_vnd
FROM products p
LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active
WHERE p.status = 'active'
GROUP BY p.id
ORDER BY p.created_at DESC
LIMIT $1 OFFSET $2;

-- name: GetProductBySlug :one
SELECT id, slug, name, short_desc, description, meta_title, meta_description
FROM products
WHERE slug = $1 AND status = 'active';

-- name: ListVariantsByProduct :many
SELECT id, sku, name, price_vnd
FROM product_variants
WHERE product_id = $1 AND is_active
ORDER BY price_vnd ASC;

-- name: CreateProduct :one
INSERT INTO products (slug, name, short_desc, description, category_id, status, meta_title, meta_description)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id;

-- name: CreateVariant :one
INSERT INTO product_variants (product_id, sku, name, price_vnd)
VALUES ($1, $2, $3, $4)
RETURNING id;
