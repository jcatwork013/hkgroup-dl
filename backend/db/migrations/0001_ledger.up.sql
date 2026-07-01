-- 0001 LEDGER KÉP + AUDIT — nền tảng tiền (BẤT BIẾN #1,#2,#8)
-- Tiền là BIGINT đồng VND. Số dư = SUM(ledger_entries). Audit bất biến.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- Ví: định danh = (kind, owner_id). owner_id NULL = ví hệ thống (singleton).
CREATE TABLE wallets (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind       TEXT        NOT NULL,
    owner_id   UUID        NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT wallets_kind_chk CHECK (kind IN (
        'commission','point','investor','referral','company',
        'community_pool','shareholder_pool','revenue','cash'
    ))
);
-- Ví user/hub/investor: duy nhất theo (kind, owner_id).
CREATE UNIQUE INDEX wallets_kind_owner_uniq ON wallets (kind, owner_id) WHERE owner_id IS NOT NULL;
-- Ví hệ thống: duy nhất theo kind.
CREATE UNIQUE INDEX wallets_system_kind_uniq ON wallets (kind) WHERE owner_id IS NULL;

-- Bút toán: mỗi dòng amount > 0; chiều qua direction. Nhóm theo journal_id (1 giao dịch).
-- KHÔNG bao giờ UPDATE/DELETE (sửa sai = ghi journal đảo). Trigger chặn bên dưới.
CREATE TABLE ledger_entries (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    journal_id UUID        NOT NULL,
    wallet_id  BIGINT      NOT NULL REFERENCES wallets(id),
    direction  TEXT        NOT NULL CHECK (direction IN ('debit','credit')),
    amount     BIGINT      NOT NULL CHECK (amount > 0),
    ref_type   TEXT        NOT NULL,
    ref_id     TEXT        NOT NULL,
    memo       TEXT        NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ledger_entries_wallet_idx  ON ledger_entries (wallet_id);
CREATE INDEX ledger_entries_ref_idx     ON ledger_entries (ref_type, ref_id);
CREATE INDEX ledger_entries_journal_idx ON ledger_entries (journal_id);

-- Bất biến: ledger append-only. Chặn UPDATE/DELETE ở tầng DB.
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'append-only table %, không được % entry', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_no_update BEFORE UPDATE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER ledger_entries_no_delete BEFORE DELETE ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Audit log bất biến (BẤT BIẾN #8): mọi thay đổi tiền/trạng thái.
CREATE TABLE audit_log (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id    UUID        NULL,
    actor_role  TEXT        NOT NULL DEFAULT 'system',
    action      TEXT        NOT NULL,
    entity_type TEXT        NOT NULL,
    entity_id   TEXT        NOT NULL,
    data        JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id);
CREATE INDEX audit_log_actor_idx  ON audit_log (actor_id);

CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Seed ví hệ thống singleton (company/revenue/cash/community_pool/shareholder_pool).
INSERT INTO wallets (kind, owner_id) VALUES
    ('company', NULL),
    ('revenue', NULL),
    ('cash', NULL),
    ('community_pool', NULL),
    ('shareholder_pool', NULL);
