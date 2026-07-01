-- 0006 WITHDRAWALS (T6) — rút ví hoa hồng, cửa sổ [15,30], khóa số dư.

CREATE TABLE withdrawals (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id),
    amount_vnd    BIGINT NOT NULL CHECK (amount_vnd > 0),  -- BẤT BIẾN #1
    status        TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN
                   ('REQUESTED','APPROVED','PAID','REJECTED')),
    bank_account  TEXT NOT NULL DEFAULT '',
    bank_name     TEXT NOT NULL DEFAULT '',
    hold_journal_id     UUID NULL,   -- journal khóa số dư khi REQUESTED
    release_journal_id  UUID NULL,   -- journal nhả khóa khi REJECTED
    payout_journal_id   UUID NULL,   -- journal chi tiền khi PAID
    requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at    TIMESTAMPTZ NULL,
    note          TEXT NOT NULL DEFAULT ''
);
CREATE INDEX withdrawals_user_idx   ON withdrawals (user_id);
CREATE INDEX withdrawals_status_idx ON withdrawals (status);

-- Chỉ cho phép 1 yêu cầu đang chờ (REQUESTED/APPROVED) mỗi user — chặn rút trùng.
CREATE UNIQUE INDEX withdrawals_one_pending_per_user
    ON withdrawals (user_id) WHERE status IN ('REQUESTED','APPROVED');
