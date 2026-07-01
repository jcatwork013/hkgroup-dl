# ── HKGROUP backend: build api + worker + migrate trong 1 image ──────────────
FROM golang:1.22-alpine AS build
WORKDIR /src
ENV CGO_ENABLED=0 GOFLAGS=-mod=mod GOSUMDB=off
RUN apk add --no-cache git
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -trimpath -ldflags="-s -w" -o /out/api     ./cmd/api  \
 && go build -trimpath -ldflags="-s -w" -o /out/worker  ./cmd/worker \
 && go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate

# ── runtime tối giản ─────────────────────────────────────────────────────────
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata wget \
 && adduser -D -u 10001 app \
 && mkdir -p /data/uploads && chown -R app:app /data
COPY --from=build /out/api /out/worker /out/migrate /usr/local/bin/
USER app
EXPOSE 8090
# Mặc định chạy API; worker/migrate override bằng `command` trong compose.
CMD ["/usr/local/bin/api"]
