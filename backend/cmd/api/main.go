// api: HTTP server cho HKGROUP.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/hkgroup/backend/internal/allocation"
	"github.com/hkgroup/backend/internal/api"
	"github.com/hkgroup/backend/internal/auth"
	"github.com/hkgroup/backend/internal/community"
	"github.com/hkgroup/backend/internal/config"
	"github.com/hkgroup/backend/internal/hub"
	"github.com/hkgroup/backend/internal/order"
	pdb "github.com/hkgroup/backend/internal/platform/db"
	"github.com/hkgroup/backend/internal/platform/events"
	"github.com/hkgroup/backend/internal/withdrawal"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	db, err := pdb.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("kết nối DB: %v", err)
	}
	defer db.Close()

	// NATS: best-effort. Không có NATS thì API vẫn chạy (chỉ không phát sự kiện).
	var pub order.Publisher
	if bus, err := events.Connect(cfg.NATSURL); err != nil {
		log.Printf("[api] CẢNH BÁO: không kết nối NATS (%v) — sự kiện sẽ không được phát", err)
	} else {
		defer bus.Close()
		pub = bus
		log.Printf("[api] NATS connected: %s", cfg.NATSURL)
	}

	srv := &api.Server{
		DB:         db,
		Auth:       auth.NewService(db, cfg.JWTSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL),
		Orders:     order.NewService(db, pub),
		Withdrawal: withdrawal.NewService(db, db.Pool, cfg.Withdrawal),
		Community:  community.NewJob(db, db.Pool, cfg.Community),
		Engine:     allocation.NewEngine(db, cfg.Allocation),
		Hub:        hub.NewService(db, cfg.HubThresholds),

		UploadDir:    cfg.UploadDir,
		APIPublicURL: cfg.APIPublicURL,
	}

	httpSrv := &http.Server{
		Addr:              ":" + cfg.APIPort,
		Handler:           srv.Routes(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("[api] listening on :%s (env=%s)", cfg.APIPort, cfg.AppEnv)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http server: %v", err)
		}
	}()

	// Graceful shutdown.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Println("[api] shutting down...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutdownCtx)
}
