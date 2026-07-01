-- name: CreateUser :one
INSERT INTO users (email, phone, password_hash, full_name)
VALUES (NULLIF($1,'')::citext, NULLIF($2,''), $3, $4)
RETURNING id;

-- name: GetUserByContact :one
SELECT id, password_hash, is_active
FROM users
WHERE is_active AND (email = LOWER($1)::citext OR phone = $1)
LIMIT 1;

-- name: AddRole :exec
INSERT INTO user_roles (user_id, role) VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: ListRoles :many
SELECT role FROM user_roles WHERE user_id = $1;
