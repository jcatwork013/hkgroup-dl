-- 0002 AUTH & RBAC (T1) — 1 user có thể vừa customer vừa affiliate.

CREATE EXTENSION IF NOT EXISTS citext; -- email không phân biệt hoa/thường

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         CITEXT NULL,
    phone         TEXT   NULL,
    password_hash TEXT   NOT NULL,
    full_name     TEXT   NOT NULL DEFAULT '',
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_contact_chk CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE UNIQUE INDEX users_email_uniq ON users (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX users_phone_uniq ON users (phone) WHERE phone IS NOT NULL;

-- RBAC: nhiều role / user.
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role    TEXT NOT NULL CHECK (role IN ('customer','affiliate','hub','admin')),
    PRIMARY KEY (user_id, role)
);

-- Refresh token (lưu hash, không lưu token thô).
CREATE TABLE refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
CREATE UNIQUE INDEX refresh_tokens_hash_uniq ON refresh_tokens (token_hash);

-- OTP đăng nhập/quên mật khẩu (lưu hash code).
CREATE TABLE otp_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier  TEXT NOT NULL, -- email hoặc phone
    code_hash   TEXT NOT NULL,
    purpose     TEXT NOT NULL CHECK (purpose IN ('login','reset_password','verify')),
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX otp_codes_identifier_idx ON otp_codes (identifier, purpose);
