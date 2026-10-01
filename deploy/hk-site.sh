#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CÔNG TẮC TẠM ĐÓNG / MỞ LẠI TOÀN BỘ HỆ THỐNG duoclieuhk
#
#   duoclieuhk.vn · www · invest.duoclieuhk.vn · admin.duoclieuhk.vn
#   api.duoclieuhk.vn · api-web.duoclieuhk.vn
#
# Chặn ở tầng nginx → tắt HẾT trong 1 lệnh, KHÔNG cần build lại app, KHÔNG dừng
# container (dữ liệu/DB/đơn hàng vẫn nguyên, mở lại là chạy tiếp ngay).
#
#   sudo deploy/hk-site.sh close                  # ĐÓNG hết (503 + trang tạm đóng)
#   sudo deploy/hk-site.sh close --until "15/09/2026" --msg "Nâng cấp hệ thống"
#   sudo deploy/hk-site.sh open                   # MỞ lại hết
#   deploy/hk-site.sh status                      # xem đang đóng/mở + thử từng domain
#   sudo deploy/hk-site.sh install                # cài/cập nhật config nginx (1 lần)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FLAG_DIR=/etc/nginx/flags
FLAG="$FLAG_DIR/duoclieuhk.closed"
WEBROOT=/var/www/duoclieuhk-closed
CONFD=/etc/nginx/conf.d/duoclieuhk-closed.conf
SNIP_HTML=/etc/nginx/snippets/duoclieuhk-closed.conf
SNIP_API=/etc/nginx/snippets/duoclieuhk-closed-api.conf

DOMAINS=(duoclieuhk.vn www.duoclieuhk.vn invest.duoclieuhk.vn admin.duoclieuhk.vn
         api.duoclieuhk.vn api-web.duoclieuhk.vn)

# Nội dung mặc định của trang tạm đóng (ghi đè bằng cờ --title/--msg/--until/...)
TITLE="Website đang tạm đóng"
MESSAGE="Chúng tôi tạm dừng phục vụ để nâng cấp và hoàn thiện hệ thống. Mọi đơn hàng, số dư hoa hồng và quyền lợi affiliate đã ghi nhận vẫn được bảo lưu đầy đủ."
UNTIL=""
HOTLINE="0948 579 759"
EMAIL="info@duoclieuhk.vn"
RETRY_AFTER=86400

die() { echo "❌ $*" >&2; exit 1; }
need_root() { [[ $EUID -eq 0 ]] || die "Cần chạy bằng root (sudo)."; }
esc() { local s=$1; s=${s//&/&amp;}; s=${s//</&lt;}; s=${s//>/&gt;}; printf '%s' "$s"; }

parse_opts() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --title)   TITLE=$2;   shift 2 ;;
      --msg)     MESSAGE=$2; shift 2 ;;
      --until)   UNTIL=$2;   shift 2 ;;
      --hotline) HOTLINE=$2; shift 2 ;;
      --email)   EMAIL=$2;   shift 2 ;;
      --key)     BYPASS_KEY=$2; shift 2 ;;
      *) die "Tham số lạ: $1" ;;
    esac
  done
}

render_page() {
  mkdir -p "$WEBROOT"
  local tel until_block html json
  tel=$(printf '%s' "$HOTLINE" | tr -cd '0-9+')
  if [[ -n $UNTIL ]]; then
    until_block="<div class=\"until\">Dự kiến mở lại: $(esc "$UNTIL")</div>"
  else
    until_block=""
  fi

  html=$(cat "$REPO/deploy/closed-page/index.html.tpl")
  html=${html//'{{TITLE}}'/$(esc "$TITLE")}
  html=${html//'{{MESSAGE}}'/$(esc "$MESSAGE")}
  html=${html//'{{UNTIL_BLOCK}}'/$until_block}
  html=${html//'{{HOTLINE}}'/$(esc "$HOTLINE")}
  html=${html//'{{TEL}}'/$tel}
  html=${html//'{{EMAIL}}'/$(esc "$EMAIL")}
  printf '%s\n' "$html" > "$WEBROOT/__hk_closed.html"

  json=$(cat "$REPO/deploy/closed-page/closed.json.tpl")
  json=${json//'{{MESSAGE}}'/${MESSAGE//\"/\\\"}}
  json=${json//'{{HOTLINE}}'/$HOTLINE}
  json=${json//'{{RETRY_AFTER}}'/$RETRY_AFTER}
  printf '%s' "$json" > "$WEBROOT/__hk_closed.json"

  chmod 644 "$WEBROOT"/__hk_closed.*
}

cmd_install() {
  need_root
  mkdir -p "$FLAG_DIR" "$WEBROOT"
  chmod 755 "$FLAG_DIR"

  # Khoá xem trước: giữ nguyên nếu đã cài, chưa có thì sinh ngẫu nhiên.
  local key="${BYPASS_KEY:-}"
  if [[ -z $key && -f $CONFD ]]; then
    key=$(grep -oP 'hk_open=\K[^;]+' "$CONFD" | head -1 || true)
  fi
  [[ -n $key ]] || key=$(openssl rand -hex 8)

  sed "s/__BYPASS_KEY__/$key/g" "$REPO/deploy/nginx/duoclieuhk-closed.conf" > "$CONFD"
  cp "$REPO/deploy/nginx/snippet-duoclieuhk-closed.conf"     "$SNIP_HTML"
  cp "$REPO/deploy/nginx/snippet-duoclieuhk-closed-api.conf" "$SNIP_API"
  render_page

  nginx -t || die "nginx -t FAIL — chưa reload, config cũ vẫn chạy."
  systemctl reload nginx
  sleep 1   # reload là bất đồng bộ: chờ worker mới nhận config trước khi test
  echo "✅ Đã cài công tắc. Khoá xem trước: ?mo_cua=$key"

  # Nhắc nếu vhost nào chưa include snippet (chưa chịu tác dụng của cờ).
  local f
  for f in /etc/nginx/sites-enabled/*duoclieuhk*; do
    grep -q "duoclieuhk-closed" "$f" || echo "⚠️  CHƯA gắn công tắc: $f"
  done
}

cmd_close() {
  need_root
  [[ -f $CONFD ]] || die "Chưa cài. Chạy: sudo $0 install"
  render_page
  touch "$FLAG"
  echo "🔒 ĐÃ ĐÓNG toàn bộ duoclieuhk (503 + trang tạm đóng). Mở lại: sudo $0 open"
  cmd_status
}

cmd_open() {
  need_root
  rm -f "$FLAG"
  echo "🔓 ĐÃ MỞ LẠI toàn bộ duoclieuhk."
  cmd_status
}

cmd_status() {
  if [[ -f $FLAG ]]; then
    echo "TRẠNG THÁI: 🔒 ĐANG ĐÓNG (cờ: $FLAG — từ $(date -r "$FLAG" '+%d/%m/%Y %H:%M'))"
  else
    echo "TRẠNG THÁI: 🔓 ĐANG MỞ (không có cờ $FLAG)"
  fi
  local d code
  for d in "${DOMAINS[@]}"; do
    code=$(curl -sk -o /dev/null -w '%{http_code}' -m 8 --resolve "$d:443:127.0.0.1" "https://$d/" || echo "ERR")
    printf '  %-26s HTTP %s\n' "$d" "$code"
  done
  echo "  (503 = đang đóng · 200/301/302 = đang phục vụ)"
}

case "${1:-status}" in
  install) shift; parse_opts "$@"; cmd_install ;;
  close)   shift; parse_opts "$@"; cmd_close ;;
  open)    shift; cmd_open ;;
  status)  cmd_status ;;
  *) sed -n '2,22p' "$0"; exit 1 ;;
esac
