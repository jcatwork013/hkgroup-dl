package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/hkgroup/backend/internal/platform/httpx"
)

// ===== SETTINGS (CMS điều khiển toàn bộ nội dung) =====

func (s *Server) handleGetSettings(w http.ResponseWriter, r *http.Request) {
	var raw []byte
	err := s.DB.Pool.QueryRow(r.Context(), `SELECT value FROM site_settings WHERE key='site'`).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.JSON(w, http.StatusOK, map[string]any{})
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_, _ = w.Write(raw)
}

func (s *Server) handlePutSettings(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "BAD_BODY", err.Error())
		return
	}
	if !json.Valid(raw) {
		httpx.Error(w, http.StatusBadRequest, "BAD_JSON", "body phải là JSON hợp lệ")
		return
	}
	// Merge top-level vào document hiện tại (admin gửi object đầy đủ).
	var merged []byte
	err = s.DB.Pool.QueryRow(r.Context(),
		`INSERT INTO site_settings(key, value) VALUES('site', $1::jsonb)
		 ON CONFLICT (key) DO UPDATE SET value = site_settings.value || EXCLUDED.value, updated_at=now()
		 RETURNING value`, raw).Scan(&merged)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_, _ = w.Write(merged)
}

// ===== UPLOAD ảnh (lưu volume độc lập, serve tại /uploads) =====

var allowedImageExt = map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true, ".svg": true}

func (s *Server) handleUpload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(12 << 20); err != nil { // tối đa 12MB
		httpx.Error(w, http.StatusBadRequest, "BAD_UPLOAD", err.Error())
		return
	}
	file, hdr, err := r.FormFile("file")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "NO_FILE", "thiếu field 'file'")
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(hdr.Filename))
	if !allowedImageExt[ext] {
		httpx.Error(w, http.StatusUnsupportedMediaType, "BAD_TYPE", "chỉ chấp nhận ảnh (jpg/png/webp/gif/svg)")
		return
	}
	if err := os.MkdirAll(s.UploadDir, 0o755); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "MKDIR", err.Error())
		return
	}
	name := uuid.NewString() + ext
	dst, err := os.Create(filepath.Join(s.UploadDir, name))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "SAVE", err.Error())
		return
	}
	defer dst.Close()
	if _, err := io.Copy(dst, io.LimitReader(file, 12<<20)); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "WRITE", err.Error())
		return
	}
	url := "/uploads/" + name
	if s.APIPublicURL != "" {
		url = strings.TrimRight(s.APIPublicURL, "/") + url
	}
	httpx.JSON(w, http.StatusCreated, map[string]string{"url": url})
}

// ===== PRODUCT CRUD (admin) =====

type productInput struct {
	ID              string   `json:"id"` // bỏ qua khi tạo/sửa (id lấy từ URL); chấp nhận để không lỗi unknown-field
	Slug            string   `json:"slug"`
	Name            string   `json:"name"`
	ShortDesc       string   `json:"short_desc"`
	Description     string   `json:"description"`
	Status          string   `json:"status"` // draft|active|archived
	Images          []string `json:"images"`
	MetaTitle       string   `json:"meta_title"`
	MetaDescription string   `json:"meta_description"`
	PriceVND        int64    `json:"price_vnd"`
}

func (s *Server) handleAdminListProducts(w http.ResponseWriter, r *http.Request) {
	rows, err := s.DB.Pool.Query(r.Context(),
		`SELECT p.id, p.slug, p.name, p.short_desc, p.description, p.status, p.images,
		        p.meta_title, p.meta_description, COALESCE(MIN(pv.price_vnd),0)::bigint
		 FROM products p LEFT JOIN product_variants pv ON pv.product_id=p.id
		 GROUP BY p.id ORDER BY p.created_at DESC`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, slug, name, short, desc, status, metaT, metaD string
		var images []byte
		var price int64
		if err := rows.Scan(&id, &slug, &name, &short, &desc, &status, &images, &metaT, &metaD, &price); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "SCAN", err.Error())
			return
		}
		var imgs []string
		_ = json.Unmarshal(images, &imgs)
		out = append(out, map[string]any{
			"id": id, "slug": slug, "name": name, "short_desc": short, "description": desc,
			"status": status, "images": imgs, "meta_title": metaT, "meta_description": metaD, "price_vnd": price,
		})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"products": out})
}

func (s *Server) handleAdminCreateProduct(w http.ResponseWriter, r *http.Request) {
	var in productInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "BAD_INPUT", err.Error())
		return
	}
	if in.Slug == "" || in.Name == "" {
		httpx.Error(w, http.StatusBadRequest, "MISSING", "cần slug và name")
		return
	}
	if in.Status == "" {
		in.Status = "active"
	}
	imgs, _ := json.Marshal(orEmpty(in.Images))
	var id string
	err := s.DB.WithTx(r.Context(), func(tx pgx.Tx) error {
		e := tx.QueryRow(r.Context(),
			`INSERT INTO products(slug,name,short_desc,description,status,images,meta_title,meta_description)
			 VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8) RETURNING id`,
			in.Slug, in.Name, in.ShortDesc, in.Description, in.Status, string(imgs), in.MetaTitle, in.MetaDescription).Scan(&id)
		if e != nil {
			return e
		}
		_, e = tx.Exec(r.Context(),
			`INSERT INTO product_variants(product_id,sku,name,price_vnd) VALUES($1,$2,'Mặc định',$3)`,
			id, "SKU-"+id[:8], in.PriceVND)
		return e
	})
	if err != nil {
		httpx.Error(w, http.StatusUnprocessableEntity, "CREATE_FAILED", err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (s *Server) handleAdminUpdateProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var in productInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "BAD_INPUT", err.Error())
		return
	}
	imgs, _ := json.Marshal(orEmpty(in.Images))
	err := s.DB.WithTx(r.Context(), func(tx pgx.Tx) error {
		ct, e := tx.Exec(r.Context(),
			`UPDATE products SET slug=$2, name=$3, short_desc=$4, description=$5, status=$6,
			   images=$7::jsonb, meta_title=$8, meta_description=$9, updated_at=now() WHERE id=$1`,
			id, in.Slug, in.Name, in.ShortDesc, in.Description, in.Status, string(imgs), in.MetaTitle, in.MetaDescription)
		if e != nil {
			return e
		}
		if ct.RowsAffected() == 0 {
			return errProductNotFound
		}
		// Cập nhật giá variant đầu tiên; nếu chưa có thì tạo.
		var vid string
		e = tx.QueryRow(r.Context(),
			`SELECT id FROM product_variants WHERE product_id=$1 ORDER BY created_at ASC LIMIT 1`, id).Scan(&vid)
		if errors.Is(e, pgx.ErrNoRows) {
			_, e = tx.Exec(r.Context(),
				`INSERT INTO product_variants(product_id,sku,name,price_vnd) VALUES($1,$2,'Mặc định',$3)`,
				id, "SKU-"+id[:8], in.PriceVND)
			return e
		}
		if e != nil {
			return e
		}
		_, e = tx.Exec(r.Context(), `UPDATE product_variants SET price_vnd=$2 WHERE id=$1`, vid, in.PriceVND)
		return e
	})
	if errors.Is(err, errProductNotFound) {
		httpx.Error(w, http.StatusNotFound, "NOT_FOUND", "sản phẩm không tồn tại")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusUnprocessableEntity, "UPDATE_FAILED", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleAdminDeleteProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	// Thử xoá; nếu bị tham chiếu bởi đơn hàng -> chuyển archived (an toàn dữ liệu).
	_, err := s.DB.Pool.Exec(r.Context(), `DELETE FROM products WHERE id=$1`, id)
	if err != nil {
		if _, e := s.DB.Pool.Exec(r.Context(), `UPDATE products SET status='archived' WHERE id=$1`, id); e == nil {
			httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "archived": true})
			return
		}
		httpx.Error(w, http.StatusUnprocessableEntity, "DELETE_FAILED", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

var errProductNotFound = fmt.Errorf("product not found")

func orEmpty(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
