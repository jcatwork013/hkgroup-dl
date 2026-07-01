package hub

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/hkgroup/backend/internal/money"
)

type TxRunner interface {
	WithTx(ctx context.Context, fn func(tx pgx.Tx) error) error
}

type Service struct {
	db TxRunner
	th Thresholds
}

func NewService(db TxRunner, th Thresholds) *Service { return &Service{db: db, th: th} }

var (
	ErrHubNotFound      = errors.New("hub: không tìm thấy hub")
	ErrInsufficientStock = errors.New("hub: tồn kho không đủ để trừ")
)

// RecordPurchase: hub nhập hàng từ HKGroup -> cộng lũy kế + cập nhật level theo ngưỡng đã chốt.
func (s *Service) RecordPurchase(ctx context.Context, hubID string, amount money.VND, note string) (int, error) {
	if !amount.IsPositive() {
		return 0, errors.New("hub: số tiền nhập phải > 0")
	}
	var newLevel int
	err := s.db.WithTx(ctx, func(tx pgx.Tx) error {
		if _, e := tx.Exec(ctx,
			`INSERT INTO hub_purchases(hub_id, amount_vnd, note) VALUES($1,$2,$3)`,
			hubID, amount.Int64(), note); e != nil {
			return fmt.Errorf("ghi hub_purchases: %w", e)
		}
		var cum int64
		if e := tx.QueryRow(ctx,
			`UPDATE hubs SET cumulative_purchase_vnd = cumulative_purchase_vnd + $2
			 WHERE id=$1 RETURNING cumulative_purchase_vnd`, hubID, amount.Int64()).Scan(&cum); e != nil {
			if errors.Is(e, pgx.ErrNoRows) {
				return ErrHubNotFound
			}
			return fmt.Errorf("cộng lũy kế: %w", e)
		}
		newLevel = s.th.LevelFor(money.VND(cum))
		if _, e := tx.Exec(ctx, `UPDATE hubs SET level=$2 WHERE id=$1`, hubID, newLevel); e != nil {
			return fmt.Errorf("cập nhật level: %w", e)
		}
		_, _ = tx.Exec(ctx,
			`INSERT INTO audit_log(actor_role, action, entity_type, entity_id, data)
			 VALUES('system','hub.purchase','hub',$1, jsonb_build_object('amount',$2::bigint,'level',$3::int))`,
			hubID, amount.Int64(), newLevel)
		return nil
	})
	return newLevel, err
}

// AddStock nhập kho cho hub (upsert cộng dồn).
func (s *Service) AddStock(ctx context.Context, hubID, variantID string, qty int) error {
	if qty <= 0 {
		return errors.New("hub: qty nhập kho phải > 0")
	}
	return s.db.WithTx(ctx, func(tx pgx.Tx) error {
		_, e := tx.Exec(ctx,
			`INSERT INTO hub_inventory(hub_id, variant_id, qty) VALUES($1,$2,$3)
			 ON CONFLICT (hub_id, variant_id) DO UPDATE SET qty = hub_inventory.qty + EXCLUDED.qty, updated_at=now()`,
			hubID, variantID, qty)
		return e
	})
}

// DeductStock trừ kho khi giao — KHÔNG cho âm (WHERE qty>=qty cần trừ + CHECK ở DB).
func (s *Service) DeductStock(ctx context.Context, hubID, variantID string, qty int) error {
	if qty <= 0 {
		return errors.New("hub: qty trừ kho phải > 0")
	}
	return s.db.WithTx(ctx, func(tx pgx.Tx) error {
		tag, e := tx.Exec(ctx,
			`UPDATE hub_inventory SET qty = qty - $3, updated_at=now()
			 WHERE hub_id=$1 AND variant_id=$2 AND qty >= $3`, hubID, variantID, qty)
		if e != nil {
			return e
		}
		if tag.RowsAffected() == 0 {
			return ErrInsufficientStock
		}
		return nil
	})
}
