// worker: consumer NATS — TRÁI TIM tự động hóa phân bổ.
// order.completed -> Allocation Engine; order.refunded -> reversal.
package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/hkgroup/backend/internal/allocation"
	"github.com/hkgroup/backend/internal/config"
	pdb "github.com/hkgroup/backend/internal/platform/db"
	"github.com/hkgroup/backend/internal/platform/events"
)

type orderEvent struct {
	OrderID string `json:"order_id"`
}

func main() {
	cfg := config.Load()
	ctx := context.Background()

	db, err := pdb.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("kết nối DB: %v", err)
	}
	defer db.Close()

	bus, err := events.Connect(cfg.NATSURL)
	if err != nil {
		log.Fatalf("kết nối NATS (worker bắt buộc cần): %v", err)
	}
	defer bus.Close()

	engine := allocation.NewEngine(db, cfg.Allocation)

	// order.completed -> phân bổ (idempotent ở DB nên retry an toàn).
	must(bus.QueueSubscribe(events.SubjectOrderCompleted, "alloc-workers", func(_ string, data []byte) error {
		var ev orderEvent
		if err := json.Unmarshal(data, &ev); err != nil {
			return err
		}
		res, err := engine.Run(ctx, ev.OrderID)
		if err != nil {
			return err
		}
		if res.Allocated {
			log.Printf("[worker] phân bổ đơn %s: aff=%d hub=%d comm=%d share=%d company=%d",
				ev.OrderID, res.Split.Affiliate, res.Split.Hub, res.Split.Community,
				res.Split.Shareholder, res.Split.Company)
			// Phát shareholder.allocate (T9 GATED — chỉ ghi nhận, consumer T9 chưa build).
			_ = bus.Publish(events.SubjectShareholderAllocate, map[string]any{
				"source_order_id": ev.OrderID, "share_vnd": res.ShareAmount.Int64(),
			})
			_ = bus.Publish(events.SubjectOrderAllocated, map[string]any{"order_id": ev.OrderID})
		} else {
			log.Printf("[worker] đơn %s đã phân bổ trước đó — bỏ qua (idempotent)", ev.OrderID)
		}
		return nil
	}))

	// order.refunded -> bút toán đảo. (durable riêng theo subject — JetStream yêu cầu)
	must(bus.QueueSubscribe(events.SubjectOrderRefunded, "refund-workers", func(_ string, data []byte) error {
		var ev orderEvent
		if err := json.Unmarshal(data, &ev); err != nil {
			return err
		}
		reversed, err := engine.Reverse(ctx, ev.OrderID)
		if err != nil {
			return err
		}
		log.Printf("[worker] reversal đơn %s: %v", ev.OrderID, reversed)
		return nil
	}))

	// shareholder.allocate -> GATED: chỉ log, KHÔNG phân bổ cho investor (chờ pháp lý).
	must(bus.QueueSubscribe(events.SubjectShareholderAllocate, "shareholder-gated", func(_ string, data []byte) error {
		log.Printf("[worker] shareholder.allocate nhận: %s (T9 GATED — không xử lý)", string(data))
		return nil
	}))

	log.Println("[worker] đang lắng nghe sự kiện... (Ctrl+C để dừng)")
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Println("[worker] shutting down...")
}

func must(err error) {
	if err != nil {
		log.Fatalf("subscribe: %v", err)
	}
}
