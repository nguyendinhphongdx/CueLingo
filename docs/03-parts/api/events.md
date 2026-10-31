# Events

> Phần: [API service](README.md) · Code: `services/api/src/modules/events/`

Nhận và kiểm tra event học tập/sản phẩm, ghi vào bảng `events` (append-only).

## Trách nhiệm

- Validate theo catalog trong `@cuelingo/shared/events`
- Ghi batch, idempotent theo `eventId`
- Đẩy sang analytics (PostHog)

## Phạm vi MVP

- Toàn bộ

## Interface

- `POST /v1/events` (batch), hàm nội bộ `record(event)`

## Phụ thuộc

- `@cuelingo/shared`

## Dữ liệu & sự kiện

- Bảng `events`

## Câu hỏi mở

- (chưa có)
