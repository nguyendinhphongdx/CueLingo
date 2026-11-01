# Assist

> Phần: [API service](./README.md) · Code: `services/api/src/modules/assist/`

Tra từ theo ngữ cảnh, recap, compose (Việt → Anh).

## Trách nhiệm

- `lookup`: nghĩa theo câu chứa từ
- `recap`: tóm tắt N giây gần nhất
- `compose`: 2 phiên bản lịch sự / ngắn gọn

## Phạm vi MVP

- F3

## Interface

| Endpoint                  | Input            | Output            |
| ------------------------- | ---------------- | ----------------- |
| `POST /v1/assist/lookup`  | `LookupRequest`  | `LookupResponse`  |
| `POST /v1/assist/recap`   | `RecapRequest`   | `RecapResponse`   |
| `POST /v1/assist/compose` | `ComposeRequest` | `ComposeResponse` |

Mọi endpoint cần xác thực. Lỗi model hoặc đầu ra JSON sai sau một lần thử lại trả `502 ASSIST_FAILED`.

## Phụ thuộc

- `@cuelingo/shared`: schema request/response
- `@cuelingo/ai-gateway`: gọi task `assist.lookup`, `assist.recap`, `assist.compose`
- `@cuelingo/prompts`: prompt phiên bản và schema đầu ra chặt hơn cho từng task

## Dữ liệu & sự kiện

- Không lưu request hoặc response.
- Gateway chỉ ghi metadata của lần gọi AI, không ghi nội dung người dùng.

## Câu hỏi mở

- (chưa có)
