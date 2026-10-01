SHELL := /bin/bash
GO    ?= go
DATABASE_URL ?= postgres://hk:hk@localhost:5441/hkgroup?sslmode=disable
export DATABASE_URL

.PHONY: help
help: ## Hiển thị danh sách lệnh
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS=":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ---------- Hạ tầng ----------
.PHONY: up
up: ## Bật postgres + redis + nats (docker)
	docker compose up -d

.PHONY: down
down: ## Tắt hạ tầng
	docker compose down

.PHONY: reset-db
reset-db: ## Xoá volume DB rồi bật lại (MẤT DỮ LIỆU)
	docker compose down -v && docker compose up -d postgres

# ---------- Backend ----------
.PHONY: migrate-up
migrate-up: ## Chạy migration thuận
	cd backend && $(GO) run ./cmd/migrate up

.PHONY: migrate-down
migrate-down: ## Rollback 1 migration
	cd backend && $(GO) run ./cmd/migrate down

.PHONY: sqlc
sqlc: ## Generate code từ sqlc
	cd backend && sqlc generate

.PHONY: build
build: ## Build api + worker
	cd backend && $(GO) build -o bin/api ./cmd/api && $(GO) build -o bin/worker ./cmd/worker

.PHONY: api
api: ## Chạy API server
	cd backend && $(GO) run ./cmd/api

.PHONY: worker
worker: ## Chạy worker (NATS consumers + jobs)
	cd backend && $(GO) run ./cmd/worker

# ---------- Test & chất lượng ----------
.PHONY: test
test: ## Chạy toàn bộ test
	cd backend && $(GO) test ./...

.PHONY: test-money
test-money: ## Chỉ test core tiền (chạy không cần DB)
	cd backend && $(GO) test ./internal/money/... ./internal/ledger/... ./internal/allocation/... ./internal/order/... ./internal/withdrawal/... ./internal/community/... ./internal/hub/... -v

.PHONY: test-integration
test-integration: ## Test cần Postgres (build tag integration)
	cd backend && $(GO) test -tags=integration ./... -v

.PHONY: cover
cover: ## Test + coverage
	cd backend && $(GO) test -cover ./...

.PHONY: race
race: ## Test với race detector
	cd backend && $(GO) test -race ./...

.PHONY: lint
lint: ## go vet
	cd backend && $(GO) vet ./...

.PHONY: grep-float
grep-float: ## BẤT BIẾN #1: chặn float trên đường đi của tiền
	@echo "==> Quét float trong code tiền (money/ledger/allocation/order/withdrawal/community)..."
	@! grep -rnE '\b(float32|float64)\b' backend/internal/money backend/internal/ledger backend/internal/allocation backend/internal/order backend/internal/withdrawal backend/internal/community backend/internal/hub 2>/dev/null \
		|| (echo "❌ Phát hiện float trên đường đi của tiền — VI PHẠM BẤT BIẾN #1" && exit 1)
	@echo "✅ Không có float trên đường đi của tiền."

# ---------- Frontend ----------
# ---------- Vận hành site (công tắc tạm đóng) ----------
.PHONY: site-close
site-close: ## ĐÓNG toàn bộ duoclieuhk (web + invest + admin + api) → 503 + trang tạm đóng
	sudo ./deploy/hk-site.sh close

.PHONY: site-open
site-open: ## MỞ LẠI toàn bộ duoclieuhk
	sudo ./deploy/hk-site.sh open

.PHONY: site-status
site-status: ## Đang đóng hay mở? (thử lần lượt từng domain)
	./deploy/hk-site.sh status

# ---------- Frontend ----------
.PHONY: web
web: ## Chạy Next.js dev
	cd frontend && npm run dev

.PHONY: web-build
web-build: ## Build Next.js production
	cd frontend && npm run build
