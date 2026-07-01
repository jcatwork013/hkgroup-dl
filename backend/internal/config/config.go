// Package config nạp cấu hình từ env (12-factor). Tỷ lệ tiền cấu hình được, KHÔNG hardcode.
package config

import (
	"os"
	"strconv"
	"time"

	"github.com/hkgroup/backend/internal/allocation"
	"github.com/hkgroup/backend/internal/community"
	"github.com/hkgroup/backend/internal/hub"
	"github.com/hkgroup/backend/internal/money"
	"github.com/hkgroup/backend/internal/withdrawal"
)

type Config struct {
	APIPort      string
	AppEnv       string
	DatabaseURL  string
	RedisURL     string
	NATSURL      string
	APIPublicURL string // base URL công khai của API (để dựng link ảnh upload)
	UploadDir    string // thư mục lưu ảnh upload (volume độc lập)

	JWTSecret     string
	JWTAccessTTL  time.Duration
	JWTRefreshTTL time.Duration

	Allocation    allocation.Config
	Withdrawal    withdrawal.Window
	Community     community.Config
	HubThresholds hub.Thresholds
}

func Load() Config {
	return Config{
		APIPort:     env("API_PORT", "8090"),
		AppEnv:      env("APP_ENV", "development"),
		DatabaseURL:  env("DATABASE_URL", "postgres://hk:hk@localhost:5441/hkgroup?sslmode=disable"),
		RedisURL:     env("REDIS_URL", "redis://localhost:6390/0"),
		NATSURL:      env("NATS_URL", "nats://localhost:4232"),
		APIPublicURL: env("API_PUBLIC_URL", ""),
		UploadDir:    env("UPLOAD_DIR", "./uploads"),

		JWTSecret:     env("JWT_SECRET", "dev-change-me-32bytes-minimum-secret!!"),
		JWTAccessTTL:  envDur("JWT_ACCESS_TTL", 15*time.Minute),
		JWTRefreshTTL: envDur("JWT_REFRESH_TTL", 720*time.Hour),

		Allocation: allocation.Config{
			AffiliateBPS:   envI64("ALLOC_AFFILIATE_BPS", 1000),
			CommunityBPS:   envI64("ALLOC_COMMUNITY_BPS", 500),
			ShareholderBPS: envI64("ALLOC_SHAREHOLDER_BPS", 1500),
			HubRateBPS: map[int]int64{
				1: envI64("HUB_RATE_L1_BPS", 1500),
				2: envI64("HUB_RATE_L2_BPS", 2000),
				3: envI64("HUB_RATE_L3_BPS", 2500),
			},
		},
		Withdrawal: withdrawal.Window{
			StartDay: int(envI64("WITHDRAW_WINDOW_START", 15)),
			EndDay:   int(envI64("WITHDRAW_WINDOW_END", 30)),
		},
		Community: community.Config{
			EligibleMinVND: money.VND(envI64("COMMUNITY_ELIGIBLE_MIN", 1_000_000)),
			Basis:          community.BasisPerPeriod, // ĐÃ CHỐT: theo KỲ
		},
		// Ngưỡng hub ĐÃ CHỐT: L1 <50tr · L2 [50tr,100tr) · L3 >=100tr.
		HubThresholds: hub.Thresholds{
			L2Min: money.VND(envI64("HUB_LEVEL_L2_MIN", 50_000_000)),
			L3Min: money.VND(envI64("HUB_LEVEL_L3_MIN", 100_000_000)),
		},
	}
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func envI64(k string, def int64) int64 {
	if v := os.Getenv(k); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n
		}
	}
	return def
}

func envDur(k string, def time.Duration) time.Duration {
	if v := os.Getenv(k); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return def
}
