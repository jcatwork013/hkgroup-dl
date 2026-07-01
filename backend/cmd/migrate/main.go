// migrate: runner migration thuần (up = áp tất cả pending, down = rollback 1 bước).
// Theo dõi trong bảng schema_migrations. Migration thuận+nghịch là yêu cầu DoD.
package main

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	dbfs "github.com/hkgroup/backend/db"
)

func main() {
	cmd := "up"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		url = "postgres://hk:hk@localhost:5441/hkgroup?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		fatal("kết nối DB: %v", err)
	}
	defer conn.Close(ctx)

	if _, err := conn.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
		fatal("tạo schema_migrations: %v", err)
	}

	switch cmd {
	case "up":
		runUp(ctx, conn)
	case "down":
		runDown(ctx, conn)
	case "status":
		runStatus(ctx, conn)
	default:
		fatal("lệnh không hợp lệ: %q (dùng up|down|status)", cmd)
	}
}

type migration struct {
	version string // vd "0001_ledger"
	up, down string
}

func loadMigrations() []migration {
	entries, err := fs.ReadDir(dbfs.Migrations, "migrations")
	if err != nil {
		fatal("đọc migrations: %v", err)
	}
	byVer := map[string]*migration{}
	var order []string
	for _, e := range entries {
		name := e.Name()
		switch {
		case strings.HasSuffix(name, ".up.sql"):
			ver := strings.TrimSuffix(name, ".up.sql")
			b, _ := fs.ReadFile(dbfs.Migrations, "migrations/"+name)
			get(byVer, ver, &order).up = string(b)
		case strings.HasSuffix(name, ".down.sql"):
			ver := strings.TrimSuffix(name, ".down.sql")
			b, _ := fs.ReadFile(dbfs.Migrations, "migrations/"+name)
			get(byVer, ver, &order).down = string(b)
		}
	}
	sort.Strings(order)
	out := make([]migration, 0, len(order))
	for _, v := range order {
		out = append(out, *byVer[v])
	}
	return out
}

func get(m map[string]*migration, ver string, order *[]string) *migration {
	if _, ok := m[ver]; !ok {
		m[ver] = &migration{version: ver}
		*order = append(*order, ver)
	}
	return m[ver]
}

func applied(ctx context.Context, conn *pgx.Conn) map[string]bool {
	rows, err := conn.Query(ctx, `SELECT version FROM schema_migrations`)
	if err != nil {
		fatal("đọc schema_migrations: %v", err)
	}
	defer rows.Close()
	set := map[string]bool{}
	for rows.Next() {
		var v string
		_ = rows.Scan(&v)
		set[v] = true
	}
	return set
}

func runUp(ctx context.Context, conn *pgx.Conn) {
	done := applied(ctx, conn)
	n := 0
	for _, m := range loadMigrations() {
		if done[m.version] {
			continue
		}
		fmt.Printf("==> áp %s\n", m.version)
		tx, err := conn.Begin(ctx)
		if err != nil {
			fatal("begin: %v", err)
		}
		if _, err := tx.Exec(ctx, m.up); err != nil {
			_ = tx.Rollback(ctx)
			fatal("lỗi áp %s: %v", m.version, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations(version) VALUES($1)`, m.version); err != nil {
			_ = tx.Rollback(ctx)
			fatal("ghi version: %v", err)
		}
		if err := tx.Commit(ctx); err != nil {
			fatal("commit: %v", err)
		}
		n++
	}
	fmt.Printf("✅ áp %d migration. Đã đồng bộ.\n", n)
}

func runDown(ctx context.Context, conn *pgx.Conn) {
	done := applied(ctx, conn)
	all := loadMigrations()
	for i := len(all) - 1; i >= 0; i-- {
		m := all[i]
		if !done[m.version] {
			continue
		}
		fmt.Printf("==> rollback %s\n", m.version)
		tx, _ := conn.Begin(ctx)
		if _, err := tx.Exec(ctx, m.down); err != nil {
			_ = tx.Rollback(ctx)
			fatal("lỗi rollback %s: %v", m.version, err)
		}
		if _, err := tx.Exec(ctx, `DELETE FROM schema_migrations WHERE version=$1`, m.version); err != nil {
			_ = tx.Rollback(ctx)
			fatal("xóa version: %v", err)
		}
		if err := tx.Commit(ctx); err != nil {
			fatal("commit: %v", err)
		}
		fmt.Println("✅ rollback 1 migration.")
		return
	}
	fmt.Println("không có gì để rollback.")
}

func runStatus(ctx context.Context, conn *pgx.Conn) {
	done := applied(ctx, conn)
	for _, m := range loadMigrations() {
		mark := "✗ pending"
		if done[m.version] {
			mark = "✓ applied"
		}
		fmt.Printf("  %s  %s\n", mark, m.version)
	}
}

func fatal(format string, a ...any) {
	fmt.Fprintf(os.Stderr, "❌ "+format+"\n", a...)
	os.Exit(1)
}
