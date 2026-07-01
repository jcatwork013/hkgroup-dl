package order

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/hkgroup/backend/internal/platform/events"
)

type TxRunner interface {
	WithTx(ctx context.Context, fn func(tx pgx.Tx) error) error
}

// Publisher cho phép phát sự kiện sau commit (có thể nil để bỏ qua).
type Publisher interface {
	Publish(subject string, v any) error
}

type Service struct {
	db  TxRunner
	bus Publisher
}

func NewService(db TxRunner, bus Publisher) *Service { return &Service{db: db, bus: bus} }

// CreateInput: client CHỈ gửi variant + qty; giá tính ở SERVER (không tin client — BẤT BIẾN #7).
type CreateInput struct {
	CustomerID      string
	RegionCode      string
	AffiliateRefCode string // tùy chọn (1 TẦNG)
	Items           []CreateItem
}
type CreateItem struct {
	VariantID string
	Qty       int
}

// Create tạo đơn CREATED, tính tổng từ giá DB.
func (s *Service) Create(ctx context.Context, in CreateInput) (orderID, code string, err error) {
	if len(in.Items) == 0 {
		return "", "", errors.New("order: giỏ hàng rỗng")
	}
	err = s.db.WithTx(ctx, func(tx pgx.Tx) error {
		// Resolve affiliate (1 tầng, không tự giới thiệu chính mình).
		var affiliateID *string
		if in.AffiliateRefCode != "" {
			var aid string
			e := tx.QueryRow(ctx, `SELECT user_id FROM affiliate_profiles WHERE ref_code=$1 AND status='active'`,
				in.AffiliateRefCode).Scan(&aid)
			if e == nil && aid != in.CustomerID {
				affiliateID = &aid
			}
		}

		// Tính tổng từ giá server-side.
		var subtotal int64
		type line struct {
			variantID string
			name      string
			price     int64
			qty       int
		}
		lines := make([]line, 0, len(in.Items))
		for _, it := range in.Items {
			if it.Qty <= 0 {
				return errors.New("order: qty phải > 0")
			}
			var price int64
			var name string
			if e := tx.QueryRow(ctx,
				`SELECT pv.price_vnd, p.name FROM product_variants pv JOIN products p ON p.id=pv.product_id
				 WHERE pv.id=$1 AND pv.is_active`, it.VariantID).Scan(&price, &name); e != nil {
				return fmt.Errorf("variant %s không hợp lệ: %w", it.VariantID, e)
			}
			subtotal += price * int64(it.Qty)
			lines = append(lines, line{it.VariantID, name, price, it.Qty})
		}

		orderID = uuid.NewString()
		code = "HK" + orderID[:8]
		if _, e := tx.Exec(ctx,
			`INSERT INTO orders(id,code,customer_id,affiliate_id,region_code,status,subtotal_vnd,total_vnd)
			 VALUES($1,$2,$3,$4,$5,'CREATED',$6,$6)`,
			orderID, code, in.CustomerID, affiliateID, in.RegionCode, subtotal); e != nil {
			return fmt.Errorf("tạo đơn: %w", e)
		}
		for _, l := range lines {
			if _, e := tx.Exec(ctx,
				`INSERT INTO order_items(order_id,variant_id,product_name,unit_price_vnd,qty,line_total_vnd)
				 VALUES($1,$2,$3,$4,$5,$6)`,
				orderID, l.variantID, l.name, l.price, l.qty, l.price*int64(l.qty)); e != nil {
				return fmt.Errorf("tạo item: %w", e)
			}
		}
		return audit(ctx, tx, "order.created", orderID, in.CustomerID)
	})
	return orderID, code, err
}

// ConfirmPayment xử lý webhook thanh toán. IDEMPOTENT theo (provider, payment_ref) — BẤT BIẾN #3.
// Khi chuyển CREATED->PAID: tự gán hub theo khu vực.
func (s *Service) ConfirmPayment(ctx context.Context, provider, paymentRef, orderID string, amount int64, raw []byte) (newlyPaid bool, err error) {
	err = s.db.WithTx(ctx, func(tx pgx.Tx) error {
		// Gate idempotent: 1 payment_ref chỉ ghi 1 lần.
		tag, e := tx.Exec(ctx,
			`INSERT INTO payments(order_id,provider,payment_ref,amount_vnd,status,raw)
			 VALUES($1,$2,$3,$4,'succeeded',$5)
			 ON CONFLICT (provider,payment_ref) DO NOTHING`,
			orderID, provider, paymentRef, amount, raw)
		if e != nil {
			return fmt.Errorf("ghi payment: %w", e)
		}
		if tag.RowsAffected() == 0 {
			return nil // webhook trùng -> no-op (không tạo PAID lần 2)
		}

		var status, region string
		if e := tx.QueryRow(ctx, `SELECT status, region_code FROM orders WHERE id=$1 FOR UPDATE`, orderID).
			Scan(&status, &region); e != nil {
			return fmt.Errorf("đọc đơn: %w", e)
		}
		if Status(status) != StatusCreated {
			return nil // đã xử lý trạng thái khác -> không ép PAID
		}
		if _, e := Transition(StatusCreated, StatusPaid); e != nil {
			return e
		}
		// Tự gán hub theo khu vực giao (nếu có hub active).
		var hubID *string
		var hid string
		if e := tx.QueryRow(ctx, `SELECT id FROM hubs WHERE region_code=$1 AND status='active' LIMIT 1`, region).
			Scan(&hid); e == nil {
			hubID = &hid
		}
		if _, e := tx.Exec(ctx, `UPDATE orders SET status='PAID', hub_id=$2, updated_at=now() WHERE id=$1`,
			orderID, hubID); e != nil {
			return fmt.Errorf("cập nhật PAID: %w", e)
		}
		newlyPaid = true
		return audit(ctx, tx, "order.paid", orderID, "")
	})
	return newlyPaid, err
}

// Advance chuyển trạng thái đơn qua state machine (PAID->ASSIGNED->SHIPPING->COMPLETED, hoặc REFUNDED/CANCELLED).
// Sau commit: phát sự kiện order.completed / order.refunded để worker xử lý phân bổ/đảo.
func (s *Service) Advance(ctx context.Context, orderID string, to Status, actorID string) error {
	var fired Status
	err := s.db.WithTx(ctx, func(tx pgx.Tx) error {
		var from string
		if e := tx.QueryRow(ctx, `SELECT status FROM orders WHERE id=$1 FOR UPDATE`, orderID).Scan(&from); e != nil {
			return fmt.Errorf("đọc đơn: %w", e)
		}
		if Status(from) == to {
			return nil // idempotent
		}
		if _, e := Transition(Status(from), to); e != nil {
			return e
		}
		q := `UPDATE orders SET status=$2, updated_at=now() WHERE id=$1`
		if to == StatusCompleted {
			q = `UPDATE orders SET status=$2, completed_at=now(), updated_at=now() WHERE id=$1`
		}
		if _, e := tx.Exec(ctx, q, orderID, string(to)); e != nil {
			return e
		}
		fired = to
		return audit(ctx, tx, "order."+string(to), orderID, actorID)
	})
	if err != nil {
		return err
	}
	// Phát sự kiện SAU commit (đảm bảo trạng thái đã bền).
	if s.bus != nil {
		switch fired {
		case StatusCompleted:
			_ = s.bus.Publish(events.SubjectOrderCompleted, map[string]string{"order_id": orderID})
		case StatusRefunded:
			_ = s.bus.Publish(events.SubjectOrderRefunded, map[string]string{"order_id": orderID})
		}
	}
	return nil
}

func audit(ctx context.Context, tx pgx.Tx, action, orderID, actorID string) error {
	_, err := tx.Exec(ctx,
		`INSERT INTO audit_log(actor_id, actor_role, action, entity_type, entity_id)
		 VALUES(NULLIF($1,'')::uuid, CASE WHEN $1='' THEN 'system' ELSE 'user' END, $2,'order',$3)`,
		actorID, action, orderID)
	return err
}
