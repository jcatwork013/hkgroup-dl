// Package auth: đăng ký/đăng nhập, JWT, RBAC. 1 user có thể nhiều role.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	pdb "github.com/hkgroup/backend/internal/platform/db"
)

type Service struct {
	db            *pdb.DB
	jwtSecret     []byte
	accessTTL     time.Duration
	refreshTTL    time.Duration
}

func NewService(db *pdb.DB, secret string, accessTTL, refreshTTL time.Duration) *Service {
	return &Service{db: db, jwtSecret: []byte(secret), accessTTL: accessTTL, refreshTTL: refreshTTL}
}

// Claims trong access token.
type Claims struct {
	Roles []string `json:"roles"`
	jwt.RegisteredClaims
}

type Tokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
}

var (
	ErrInvalidCredentials = errors.New("auth: email/sđt hoặc mật khẩu không đúng")
	ErrContactRequired    = errors.New("auth: cần email hoặc số điện thoại")
)

type RegisterInput struct {
	Email    string
	Phone    string
	Password string
	FullName string
	Roles    []string // mặc định ['customer']
}

func (s *Service) Register(ctx context.Context, in RegisterInput) (string, error) {
	if in.Email == "" && in.Phone == "" {
		return "", ErrContactRequired
	}
	if len(in.Password) < 6 {
		return "", errors.New("auth: mật khẩu tối thiểu 6 ký tự")
	}
	if len(in.Roles) == 0 {
		in.Roles = []string{"customer"}
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	userID := uuid.NewString()
	err = s.db.WithTx(ctx, func(tx pgx.Tx) error {
		_, e := tx.Exec(ctx,
			`INSERT INTO users(id,email,phone,password_hash,full_name)
			 VALUES($1,NULLIF($2,''),NULLIF($3,''),$4,$5)`,
			userID, strings.ToLower(in.Email), in.Phone, string(hash), in.FullName)
		if e != nil {
			return fmt.Errorf("tạo user (email/sđt có thể đã tồn tại): %w", e)
		}
		for _, r := range in.Roles {
			if _, e := tx.Exec(ctx, `INSERT INTO user_roles(user_id,role) VALUES($1,$2)`, userID, r); e != nil {
				return e
			}
		}
		return nil
	})
	return userID, err
}

func (s *Service) Login(ctx context.Context, identifier, password string) (Tokens, string, error) {
	var (
		userID string
		hash   string
	)
	err := s.db.Pool.QueryRow(ctx,
		`SELECT id, password_hash FROM users
		 WHERE is_active AND (email=LOWER($1) OR phone=$1) LIMIT 1`, identifier).Scan(&userID, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return Tokens{}, "", ErrInvalidCredentials
	}
	if err != nil {
		return Tokens{}, "", err
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		return Tokens{}, "", ErrInvalidCredentials
	}
	roles, err := s.rolesOf(ctx, userID)
	if err != nil {
		return Tokens{}, "", err
	}
	tk, err := s.issue(ctx, userID, roles)
	return tk, userID, err
}

func (s *Service) rolesOf(ctx context.Context, userID string) ([]string, error) {
	rows, err := s.db.Pool.Query(ctx, `SELECT role FROM user_roles WHERE user_id=$1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var roles []string
	for rows.Next() {
		var r string
		if e := rows.Scan(&r); e != nil {
			return nil, e
		}
		roles = append(roles, r)
	}
	return roles, rows.Err()
}

func (s *Service) issue(ctx context.Context, userID string, roles []string) (Tokens, error) {
	now := time.Now()
	claims := Claims{
		Roles: roles,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessTTL)),
		},
	}
	access, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.jwtSecret)
	if err != nil {
		return Tokens{}, err
	}
	// Refresh token: random, lưu hash.
	raw := randToken()
	sum := sha256.Sum256([]byte(raw))
	if _, err := s.db.Pool.Exec(ctx,
		`INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES($1,$2,$3)`,
		userID, hex.EncodeToString(sum[:]), now.Add(s.refreshTTL)); err != nil {
		return Tokens{}, err
	}
	return Tokens{AccessToken: access, RefreshToken: raw, ExpiresIn: int64(s.accessTTL.Seconds())}, nil
}

// Verify parse + xác thực access token.
func (s *Service) Verify(token string) (*Claims, error) {
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("thuật toán ký không hợp lệ")
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}
	return claims, nil
}

func randToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
