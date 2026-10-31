# Auth

> Phần: [API service](./README.md) · Code: `services/api/src/modules/auth/`

Xác thực người dùng và cấp token ngắn hạn cho stream.

## Trách nhiệm

- Đăng nhập Google OAuth + magic link (qua nhà cung cấp auth)
- Phát JWT truy cập + refresh
- Token stream 10 phút cho WebSocket

## Phạm vi MVP

- US-01

## Interface

- Middleware `requireUser`
- `POST /v1/auth/stream-token`

## Phụ thuộc

- (chưa có)

## Dữ liệu & sự kiện

- Bảng `users`

## Câu hỏi mở

- Chọn Supabase Auth hay Clerk?
