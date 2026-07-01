-- name: GetOrder :one
SELECT id, code, customer_id, affiliate_id, hub_id, region_code, status,
       subtotal_vnd, total_vnd, completed_at
FROM orders
WHERE id = $1;

-- name: ListOrdersByCustomer :many
SELECT id, code, status, total_vnd, created_at
FROM orders
WHERE customer_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetOrderAllocation :one
SELECT order_id, total_vnd, affiliate_vnd, hub_vnd, community_vnd, shareholder_vnd, company_vnd,
       journal_id, allocated_at, reversed_at
FROM order_allocations
WHERE order_id = $1;
