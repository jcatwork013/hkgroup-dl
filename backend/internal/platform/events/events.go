// Package events bọc NATS JetStream cho pub/sub sự kiện nghiệp vụ.
// Idempotency được đảm bảo ở tầng DB (order_allocations PK…), nên at-least-once là an toàn.
package events

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/nats-io/nats.go"
)

// Subjects sự kiện (theo quy ước repo).
const (
	SubjectOrderCompleted        = "order.completed"
	SubjectOrderRefunded         = "order.refunded"
	SubjectOrderAllocated        = "order.allocated"
	SubjectShareholderAllocate   = "shareholder.allocate"
	SubjectCommunityPeriodClosed = "community.period.closed"

	streamName = "HK"
)

type Bus struct {
	nc *nats.Conn
	js nats.JetStreamContext
}

// Connect mở kết nối + đảm bảo stream tồn tại.
func Connect(url string) (*Bus, error) {
	nc, err := nats.Connect(url,
		nats.Name("hkgroup"),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(2*time.Second),
	)
	if err != nil {
		return nil, fmt.Errorf("nats connect: %w", err)
	}
	js, err := nc.JetStream()
	if err != nil {
		nc.Close()
		return nil, fmt.Errorf("jetstream: %w", err)
	}
	// Stream gom mọi subject nghiệp vụ.
	_, err = js.AddStream(&nats.StreamConfig{
		Name:     streamName,
		Subjects: []string{"order.>", "shareholder.>", "community.>"},
		Storage:  nats.FileStorage,
	})
	if err != nil && err != nats.ErrStreamNameAlreadyInUse {
		// Stream đã tồn tại với cấu hình khác -> chỉ cảnh báo, không chặn.
		log.Printf("[events] AddStream: %v", err)
	}
	return &Bus{nc: nc, js: js}, nil
}

// Publish marshal v -> JSON rồi publish (JetStream, có ack từ server).
func (b *Bus) Publish(subject string, v any) error {
	data, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}
	if _, err := b.js.Publish(subject, data); err != nil {
		return fmt.Errorf("publish %s: %w", subject, err)
	}
	return nil
}

// QueueSubscribe đăng ký consumer bền (durable) theo queue group — mỗi message chỉ 1 worker xử lý.
// handler trả nil -> ack; trả lỗi -> nak để retry (idempotency ở DB khiến retry an toàn).
func (b *Bus) QueueSubscribe(subject, durable string, handler func(subject string, data []byte) error) error {
	_, err := b.js.QueueSubscribe(subject, durable, func(m *nats.Msg) {
		if err := handler(m.Subject, m.Data); err != nil {
			log.Printf("[events] xử lý %s lỗi: %v (nak)", m.Subject, err)
			_ = m.Nak()
			return
		}
		_ = m.Ack()
	}, nats.Durable(durable), nats.ManualAck(), nats.AckWait(30*time.Second))
	if err != nil {
		return fmt.Errorf("subscribe %s: %w", subject, err)
	}
	return nil
}

func (b *Bus) Close() {
	if b.nc != nil {
		_ = b.nc.Drain()
	}
}
