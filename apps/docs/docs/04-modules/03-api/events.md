# Events

> Phần: [API service](./README.md) · Code: `services/api/src/modules/events/`

Nhận và kiểm tra event học tập/sản phẩm, ghi vào bảng `events` (append-only).

## Trách nhiệm

- Validate theo catalog trong `@cuelingo/shared/events`
- Gắn `user_id` từ session và ghi nguyên batch trong một transaction
- Chặn tham chiếu `sessionId` hoặc `segmentId` thuộc người dùng khác

## Phạm vi MVP

- Toàn bộ

## Interface

- `POST /v1/events`: nhận 1–100 event hợp lệ, trả `204`; batch sai schema trả `400`
- Không có route sửa hoặc xoá event

## Phụ thuộc

- `@cuelingo/shared`

## Dữ liệu & sự kiện

- Bảng `events`: append-only; UUID nội bộ do API sinh
- `sessionId` và `segmentId` được lưu ở cột riêng; dữ liệu theo từng loại nằm trong `payload`

## Câu hỏi mở

- (chưa có)
