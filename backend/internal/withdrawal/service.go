package withdrawal

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/hkgroup/backend/internal/ledger"
	"github.com/hkgroup/backend/internal/money"
)

// TxRunner cấp khả năng transaction.
type TxRunner interface {
	WithTx(ctx context.Context, fn func(tx pgx.Tx) error) error
}

// Service xử lý rút ví hoa hồng.
//
// MÔ HÌNH KHÓA SỐ DƯ: "hold" được thể hiện bằng CHÍNH bản ghi withdrawal đang chờ
// (REQUESTED/APPROVED) + ràng buộc DB:
//   - unique partial index: mỗi user chỉ 1 yêu cầu đang chờ (chặn rút trùng);
//   - available = số dư ledger − Σ(amount các yêu cầu đang chờ) → không cho rút âm/2 lần.
// Ledger CHỈ ghi khi tiền THỰC SỰ ra (PAID): DEBIT commission, CREDIT cash.
// Cách này tránh tài khoản "hold" giả và vẫn khóa chặt số dư (đúng BẤT BIẾN #2, #7).
type Service struct {
	db     TxRunner
	read   ledger.Querier
	window Window
}

func NewService(db TxRunner, read ledger.Querier, w Window) *Service {
	return &Service{db: db, read: read, window: w}
}

// Available = số dư hoa hồng − tổng đang giữ (pending). Đây là số được phép rút.
func (s *Service) Available(ctx context.Context, q ledger.Querier, userID string) (money.VND, error) {
	bal, err := ledger.Balance(ctx, q, ledger.WalletRef{Kind: ledger.KindCommission, OwnerID: userID})
	if err != nil {
		return 0, err
	}
	var pending int64
	if err := q.QueryRow(ctx,
		`SELECT COALESCE(SUM(amount_vnd),0) FROM withdrawals
		 WHERE user_id=$1 AND status IN ('REQUESTED','APPROVED')`, userID).Scan(&pending); err != nil {
		return 0, err
	}
	return bal.Sub(money.VND(pending)), nil
}

var ErrAlreadyPending = Error{Code: "WITHDRAW_ALREADY_PENDING", Msg: "đang có yêu cầu rút chờ xử lý"}

// Request tạo yêu cầu rút. Validate cửa sổ + đủ số dư ở SERVER (BẤT BIẾN #7), trong 1 tx.
func (s *Service) Request(ctx context.Context, userID string, amount money.VND, bankAccount, bankName string, at time.Time) (string, error) {
	var wid string
	err := s.db.WithTx(ctx, func(tx pgx.Tx) error {
		avail, err := s.Available(ctx, tx, userID)
		if err != nil {
			return err
		}
		if err := ValidateRequest(amount, avail, s.window, at); err != nil {
			return err
		}
		err = tx.QueryRow(ctx,
			`INSERT INTO withdrawals(user_id, amount_vnd, status, bank_account, bank_name)
			 VALUES($1,$2,'REQUESTED',$3,$4) RETURNING id`,
			userID, amount.Int64(), bankAccount, bankName).Scan(&wid)
		if err != nil {
			// vi phạm unique partial index -> đã có yêu cầu đang chờ.
			if isUniqueViolation(err) {
				return ErrAlreadyPending
			}
			return fmt.Errorf("tạo withdrawal: %w", err)
		}
		return audit(ctx, tx, userID, "withdrawal.requested", wid, amount)
	})
	return wid, err
}

// Approve: REQUESTED -> APPROVED (admin duyệt).
func (s *Service) Approve(ctx context.Context, wid, adminID string) error {
	return s.transition(ctx, wid, adminID, StatusApproved, func(ctx context.Context, tx pgx.Tx, w wdRow) error {
		return nil
	})
}

// Reject: -> REJECTED, nhả khóa (chỉ đổi trạng thái, không có entry ledger để đảo).
func (s *Service) Reject(ctx context.Context, wid, adminID, note string) error {
	return s.transition(ctx, wid, adminID, StatusRejected, func(ctx context.Context, tx pgx.Tx, w wdRow) error {
		_, err := tx.Exec(ctx, `UPDATE withdrawals SET note=$2 WHERE id=$1`, wid, note)
		return err
	})
}

// Pay: APPROVED -> PAID, ghi sổ chi tiền (DEBIT commission, CREDIT cash). Idempotent.
func (s *Service) Pay(ctx context.Context, wid, adminID string) error {
	return s.transition(ctx, wid, adminID, StatusPaid, func(ctx context.Context, tx pgx.Tx, w wdRow) error {
		j := ledger.NewJournal("withdrawal", wid, "chi tiền rút hoa hồng")
		j.Debit(ledger.WalletRef{Kind: ledger.KindCommission, OwnerID: w.userID}, money.VND(w.amount))
		j.Credit(ledger.WalletRef{Kind: ledger.KindCash}, money.VND(w.amount))
		jid, err := ledger.PostJournal(ctx, tx, *j)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `UPDATE withdrawals SET payout_journal_id=$2 WHERE id=$1`, wid, jid)
		return err
	})
}

type wdRow struct {
	userID string
	amount int64
	status Status
}

// transition là khung chung: khóa row, kiểm tra chuyển trạng thái hợp lệ, chạy hook, cập nhật.
// Idempotent: nếu đã ở trạng thái đích -> no-op (không lỗi).
func (s *Service) transition(ctx context.Context, wid, actorID string, to Status, hook func(context.Context, pgx.Tx, wdRow) error) error {
	return s.db.WithTx(ctx, func(tx pgx.Tx) error {
		var w wdRow
		err := tx.QueryRow(ctx,
			`SELECT user_id, amount_vnd, status FROM withdrawals WHERE id=$1 FOR UPDATE`, wid).
			Scan(&w.userID, &w.amount, &w.status)
		if errors.Is(err, pgx.ErrNoRows) {
			return Error{Code: "WITHDRAW_NOT_FOUND", Msg: "không tìm thấy yêu cầu rút"}
		}
		if err != nil {
			return err
		}
		if w.status == to {
			return nil // idempotent: đã ở trạng thái đích
		}
		if _, err := Transition(w.status, to); err != nil {
			return err
		}
		if err := hook(ctx, tx, w); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx,
			`UPDATE withdrawals SET status=$2, decided_at=now() WHERE id=$1`, wid, string(to)); err != nil {
			return err
		}
		return audit(ctx, tx, actorID, "withdrawal."+string(to), wid, money.VND(w.amount))
	})
}

func audit(ctx context.Context, tx pgx.Tx, actorID, action, wid string, amount money.VND) error {
	_, err := tx.Exec(ctx,
		`INSERT INTO audit_log(actor_id, actor_role, action, entity_type, entity_id, data)
		 VALUES(NULLIF($1,'')::uuid,'user',$2,'withdrawal',$3, jsonb_build_object('amount',$4::bigint))`,
		actorID, action, wid, amount.Int64())
	return err
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
