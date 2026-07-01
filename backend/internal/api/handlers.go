package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/hkgroup/backend/internal/auth"
	"github.com/hkgroup/backend/internal/ledger"
	"github.com/hkgroup/backend/internal/money"
	"github.com/hkgroup/backend/internal/order"
	"github.com/hkgroup/backend/internal/platform/httpx"
	"github.com/hkgroup/backend/internal/withdrawal"
)

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if err := s.DB.Pool.Ping(r.Context()); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "DB_DOWN", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// --- Auth ---

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email    string   `json:"email"`
		Phone    string   `json:"phone"`
		Password string   `json:"password"`
		FullName string   `json:"full_name"`
		Roles    []string `json:"roles"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "BAD_INPUT", err.Error())
		return
	}
	id, err := s.Auth.Register(r.Context(), auth.RegisterInput{
		Email: in.Email, Phone: in.Phone, Password: in.Password, FullName: in.FullName, Roles: in.Roles,
	})
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "REGISTER_FAILED", err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]string{"user_id": id})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Identifier string `json:"identifier"`
		Password   string `json:"password"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "BAD_INPUT", err.Error())
		return
	}
	tk, userID, err := s.Auth.Login(r.Context(), in.Identifier, in.Password)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "LOGIN_FAILED", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"user_id": userID, "tokens": tk})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	httpx.JSON(w, http.StatusOK, map[string]any{"user_id": c.Subject, "roles": c.Roles})
}

// --- Catalog (public, phục vụ SEO server-side) ---

func (s *Server) handleListProducts(w http.ResponseWriter, r *http.Request) {
	rows, err := s.DB.Pool.Query(r.Context(),
		`SELECT p.id, p.slug, p.name, p.short_desc, p.images, p.meta_title, p.meta_description,
		        COALESCE(MIN(pv.price_vnd),0)
		 FROM products p LEFT JOIN product_variants pv ON pv.product_id=p.id AND pv.is_active
		 WHERE p.status='active'
		 GROUP BY p.id ORDER BY p.created_at DESC LIMIT 100`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, slug, name, short, metaT, metaD string
		var images []byte
		var price int64
		if err := rows.Scan(&id, &slug, &name, &short, &images, &metaT, &metaD, &price); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "SCAN", err.Error())
			return
		}
		var imgs []string
		_ = json.Unmarshal(images, &imgs)
		out = append(out, map[string]any{
			"id": id, "slug": slug, "name": name, "short_desc": short,
			"min_price_vnd": price, "meta_title": metaT, "meta_description": metaD,
			"images": imgs,
		})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"products": out})
}

func (s *Server) handleGetProduct(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	var id, name, short, desc, metaT, metaD string
	var imagesRaw []byte
	if err := s.DB.Pool.QueryRow(r.Context(),
		`SELECT id,name,short_desc,description,meta_title,meta_description,images
		 FROM products WHERE slug=$1 AND status='active'`, slug).
		Scan(&id, &name, &short, &desc, &metaT, &metaD, &imagesRaw); err != nil {
		httpx.Error(w, http.StatusNotFound, "NOT_FOUND", "sản phẩm không tồn tại")
		return
	}
	var images []string
	_ = json.Unmarshal(imagesRaw, &images)
	variants := []map[string]any{}
	rows, _ := s.DB.Pool.Query(r.Context(),
		`SELECT id, sku, name, price_vnd FROM product_variants WHERE product_id=$1 AND is_active`, id)
	defer rows.Close()
	for rows.Next() {
		var vid, sku, vname string
		var price int64
		_ = rows.Scan(&vid, &sku, &vname, &price)
		variants = append(variants, map[string]any{"id": vid, "sku": sku, "name": vname, "price_vnd": price})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"id": id, "slug": slug, "name": name, "short_desc": short, "description": desc,
		"meta_title": metaT, "meta_description": metaD, "variants": variants, "images": images,
	})
}

// --- Orders & webhook ---

func (s *Server) handleCreateOrder(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	var in struct {
		RegionCode string `json:"region_code"`
		RefCode    string `json:"ref_code"`
		Items      []struct {
			VariantID string `json:"variant_id"`
			Qty       int    `json:"qty"`
		} `json:"items"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "BAD_INPUT", err.Error())
		return
	}
	items := make([]order.CreateItem, len(in.Items))
	for i, it := range in.Items {
		items[i] = order.CreateItem{VariantID: it.VariantID, Qty: it.Qty}
	}
	id, code, err := s.Orders.Create(r.Context(), order.CreateInput{
		CustomerID: c.Subject, RegionCode: in.RegionCode, AffiliateRefCode: in.RefCode, Items: items,
	})
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "CREATE_ORDER_FAILED", err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]string{"order_id": id, "code": code})
}

func (s *Server) handlePaymentWebhook(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	raw, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "BAD_BODY", err.Error())
		return
	}
	var in struct {
		OrderID    string `json:"order_id"`
		PaymentRef string `json:"payment_ref"`
		Amount     int64  `json:"amount_vnd"`
	}
	if err := json.Unmarshal(raw, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "BAD_INPUT", err.Error())
		return
	}
	// TODO prod: xác thực chữ ký webhook theo từng cổng trước khi tin.
	newlyPaid, err := s.Orders.ConfirmPayment(r.Context(), provider, in.PaymentRef, in.OrderID, in.Amount, raw)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "WEBHOOK_FAILED", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "newly_paid": newlyPaid})
}

func (s *Server) handleTrackClick(w http.ResponseWriter, r *http.Request) {
	var in struct {
		RefCode   string `json:"ref_code"`
		Path      string `json:"path"`
		VisitorID string `json:"visitor_id"`
	}
	if err := httpx.Decode(r, &in); err != nil || in.RefCode == "" {
		httpx.Error(w, http.StatusBadRequest, "BAD_INPUT", "thiếu ref_code")
		return
	}
	_, _ = s.DB.Pool.Exec(r.Context(),
		`INSERT INTO affiliate_clicks(ref_code,landing_path,visitor_id,user_agent)
		 VALUES($1,$2,$3,$4)`, in.RefCode, in.Path, in.VisitorID, r.UserAgent())
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// --- Affiliate dashboard (row-level: chỉ của chính mình) ---

func (s *Server) handleAffiliateDashboard(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	ctx := r.Context()

	var refCode string
	_ = s.DB.Pool.QueryRow(ctx, `SELECT ref_code FROM affiliate_profiles WHERE user_id=$1`, c.Subject).Scan(&refCode)

	var clicks int64
	_ = s.DB.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM affiliate_clicks WHERE ref_code=$1`, refCode).Scan(&clicks)

	var successOrders int64
	_ = s.DB.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM orders WHERE affiliate_id=$1 AND status='COMPLETED'`, c.Subject).Scan(&successOrders)

	// Hoa hồng: earned = số dư hiện tại + đã rút; paid = Σ withdrawals PAID; available = số dư ledger.
	available, _ := ledger.Balance(ctx, s.DB.Pool, ledger.WalletRef{Kind: ledger.KindCommission, OwnerID: c.Subject})
	var paid int64
	_ = s.DB.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(amount_vnd),0) FROM withdrawals WHERE user_id=$1 AND status='PAID'`, c.Subject).Scan(&paid)
	var pendingWithdraw int64
	_ = s.DB.Pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(amount_vnd),0) FROM withdrawals WHERE user_id=$1 AND status IN ('REQUESTED','APPROVED')`,
		c.Subject).Scan(&pendingWithdraw)

	conversion := 0.0
	if clicks > 0 {
		conversion = float64(successOrders) / float64(clicks) // tỷ lệ chuyển đổi (chỉ hiển thị, không phải tiền)
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ref_code":             refCode,
		"clicks":               clicks,
		"success_orders":       successOrders,
		"conversion_rate":      conversion,
		"commission_available": available.Int64(), // hoa hồng chờ rút (khả dụng)
		"commission_paid":      paid,               // đã thanh toán
		"commission_holding":   pendingWithdraw,    // đang chờ duyệt rút
	})
}

func (s *Server) handleRequestWithdrawal(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	var in struct {
		Amount      int64  `json:"amount_vnd"`
		BankAccount string `json:"bank_account"`
		BankName    string `json:"bank_name"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "BAD_INPUT", err.Error())
		return
	}
	wid, err := s.Withdrawal.Request(r.Context(), c.Subject, money.VND(in.Amount), in.BankAccount, in.BankName, time.Now())
	if err != nil {
		var we withdrawal.Error
		if errors.As(err, &we) {
			httpx.Error(w, http.StatusUnprocessableEntity, we.Code, we.Msg)
			return
		}
		httpx.Error(w, http.StatusBadRequest, "WITHDRAW_FAILED", err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]string{"withdrawal_id": wid})
}

func (s *Server) handleListMyWithdrawals(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	rows, err := s.DB.Pool.Query(r.Context(),
		`SELECT id, amount_vnd, status, requested_at FROM withdrawals WHERE user_id=$1 ORDER BY requested_at DESC`,
		c.Subject)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, status string
		var amount int64
		var at time.Time
		_ = rows.Scan(&id, &amount, &status, &at)
		out = append(out, map[string]any{"id": id, "amount_vnd": amount, "status": status, "requested_at": at})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"withdrawals": out})
}

// --- Admin ---

func (s *Server) handleAdvanceOrder(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	id := chi.URLParam(r, "id")
	var in struct {
		To string `json:"to"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "BAD_INPUT", err.Error())
		return
	}
	if err := s.Orders.Advance(r.Context(), id, order.Status(in.To), c.Subject); err != nil {
		httpx.Error(w, http.StatusUnprocessableEntity, "ADVANCE_FAILED", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "status": in.To})
}

func (s *Server) handleAdminWithdrawal(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	id := chi.URLParam(r, "id")
	action := chi.URLParam(r, "action")
	ctx := r.Context()
	var err error
	switch action {
	case "approve":
		err = s.Withdrawal.Approve(ctx, id, c.Subject)
	case "pay":
		err = s.Withdrawal.Pay(ctx, id, c.Subject)
	case "reject":
		var in struct {
			Note string `json:"note"`
		}
		_ = httpx.Decode(r, &in)
		err = s.Withdrawal.Reject(ctx, id, c.Subject, in.Note)
	default:
		httpx.Error(w, http.StatusBadRequest, "BAD_ACTION", "action: approve|pay|reject")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusUnprocessableEntity, "WITHDRAW_ACTION_FAILED", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "action": action})
}

func (s *Server) handleHubPurchase(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var in struct {
		Amount int64  `json:"amount_vnd"`
		Note   string `json:"note"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "BAD_INPUT", err.Error())
		return
	}
	level, err := s.Hub.RecordPurchase(r.Context(), id, money.VND(in.Amount), in.Note)
	if err != nil {
		httpx.Error(w, http.StatusUnprocessableEntity, "HUB_PURCHASE_FAILED", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "level": level})
}

func (s *Server) handleHubStock(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var in struct {
		VariantID string `json:"variant_id"`
		Qty       int    `json:"qty"`
		Op        string `json:"op"` // add | deduct
	}
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "BAD_INPUT", err.Error())
		return
	}
	var err error
	switch in.Op {
	case "add":
		err = s.Hub.AddStock(r.Context(), id, in.VariantID, in.Qty)
	case "deduct":
		err = s.Hub.DeductStock(r.Context(), id, in.VariantID, in.Qty)
	default:
		httpx.Error(w, http.StatusBadRequest, "BAD_OP", "op: add|deduct")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusUnprocessableEntity, "HUB_STOCK_FAILED", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleCloseCommunity(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Period string `json:"period"` // YYYY-MM
	}
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "BAD_INPUT", err.Error())
		return
	}
	res, err := s.Community.CloseMonth(r.Context(), in.Period)
	if err != nil {
		httpx.Error(w, http.StatusUnprocessableEntity, "CLOSE_FAILED", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"period_id": res.PeriodID, "pool_vnd": res.Pool.Int64(),
		"distributed_vnd": res.Distributed.Int64(), "leftover_vnd": res.Leftover.Int64(), "count": res.Count,
	})
}
