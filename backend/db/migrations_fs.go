// Package dbfs embed các file SQL migration (chỉ .sql; file .md tài liệu bị bỏ qua).
package dbfs

import "embed"

//go:embed migrations/*.sql
var Migrations embed.FS
