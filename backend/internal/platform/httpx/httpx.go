// Package httpx: tiện ích response JSON + lỗi có mã rõ ràng (DoD).
package httpx

import (
	"encoding/json"
	"net/http"
)

type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// Error trả lỗi với mã máy-đọc-được.
func Error(w http.ResponseWriter, status int, code, msg string) {
	JSON(w, status, ErrorBody{Code: code, Message: msg})
}

func Decode(r *http.Request, v any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(v)
}
