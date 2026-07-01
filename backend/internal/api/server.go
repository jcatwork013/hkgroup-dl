// Package api dựng HTTP router (Chi) và wiring các service.
package api

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/hkgroup/backend/internal/allocation"
	"github.com/hkgroup/backend/internal/auth"
	"github.com/hkgroup/backend/internal/community"
	"github.com/hkgroup/backend/internal/hub"
	"github.com/hkgroup/backend/internal/order"
	pdb "github.com/hkgroup/backend/internal/platform/db"
	"github.com/hkgroup/backend/internal/withdrawal"
)

// Server gom mọi dependency cho handlers.
type Server struct {
	DB         *pdb.DB
	Auth       *auth.Service
	Orders     *order.Service
	Withdrawal *withdrawal.Service
	Community  *community.Job
	Engine     *allocation.Engine
	Hub        *hub.Service

	UploadDir    string // thư mục lưu ảnh
	APIPublicURL string // base URL công khai (dựng link ảnh)
}

// Routes trả về http.Handler đã gắn toàn bộ route + middleware.
func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"}, // siết lại theo domain ở prod
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: false,
	}))

	r.Get("/health", s.handleHealth)

	// Static phục vụ ảnh upload (volume độc lập).
	if s.UploadDir != "" {
		fs := http.StripPrefix("/uploads/", http.FileServer(http.Dir(s.UploadDir)))
		r.Handle("/uploads/*", fs)
	}

	r.Route("/api", func(r chi.Router) {
		// --- Public ---
		r.Post("/auth/register", s.handleRegister)
		r.Post("/auth/login", s.handleLogin)
		r.Get("/settings", s.handleGetSettings)
		r.Get("/products", s.handleListProducts)
		r.Get("/products/{slug}", s.handleGetProduct)
		r.Post("/webhooks/payment/{provider}", s.handlePaymentWebhook)
		r.Post("/affiliate/track-click", s.handleTrackClick)

		// --- Authed ---
		r.Group(func(r chi.Router) {
			r.Use(s.Auth.RequireAuth)
			r.Post("/orders", s.handleCreateOrder)
			r.Get("/me", s.handleMe)

			// Affiliate (row-level: chỉ data của chính mình)
			r.Group(func(r chi.Router) {
				r.Use(auth.RequireRole("affiliate"))
				r.Get("/affiliate/dashboard", s.handleAffiliateDashboard)
				r.Post("/affiliate/withdrawals", s.handleRequestWithdrawal)
				r.Get("/affiliate/withdrawals", s.handleListMyWithdrawals)
			})

			// Admin
			r.Group(func(r chi.Router) {
				r.Use(auth.RequireRole("admin"))
				r.Post("/admin/orders/{id}/advance", s.handleAdvanceOrder)
				r.Post("/admin/withdrawals/{id}/{action}", s.handleAdminWithdrawal)
				r.Post("/admin/community/close", s.handleCloseCommunity)
				r.Post("/admin/hubs/{id}/purchase", s.handleHubPurchase)
				r.Post("/admin/hubs/{id}/stock", s.handleHubStock)
				// CMS
				r.Put("/admin/settings", s.handlePutSettings)
				r.Post("/admin/upload", s.handleUpload)
				r.Get("/admin/products", s.handleAdminListProducts)
				r.Post("/admin/products", s.handleAdminCreateProduct)
				r.Put("/admin/products/{id}", s.handleAdminUpdateProduct)
				r.Delete("/admin/products/{id}", s.handleAdminDeleteProduct)
			})
		})
	})

	return r
}
