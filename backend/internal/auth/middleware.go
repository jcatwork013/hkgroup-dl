package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/hkgroup/backend/internal/platform/httpx"
)

type ctxKey int

const claimsKey ctxKey = 1

// FromContext lấy claims đã xác thực (nil nếu chưa auth).
func FromContext(ctx context.Context) *Claims {
	c, _ := ctx.Value(claimsKey).(*Claims)
	return c
}

// RequireAuth xác thực Bearer token, gắn claims vào context.
func (s *Service) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := r.Header.Get("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			httpx.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "thiếu Bearer token")
			return
		}
		claims, err := s.Verify(strings.TrimPrefix(h, "Bearer "))
		if err != nil {
			httpx.Error(w, http.StatusUnauthorized, "INVALID_TOKEN", "token không hợp lệ hoặc hết hạn")
			return
		}
		ctx := context.WithValue(r.Context(), claimsKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole chặn nếu user không có role yêu cầu (admin luôn được phép).
func RequireRole(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c := FromContext(r.Context())
			if c == nil || !HasRole(c, role) {
				httpx.Error(w, http.StatusForbidden, "FORBIDDEN", "không đủ quyền")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func HasRole(c *Claims, role string) bool {
	if c == nil {
		return false
	}
	for _, r := range c.Roles {
		if r == role || r == "admin" {
			return true
		}
	}
	return false
}
