# Realtime gateway

> Phần: [API service](./README.md) · Code: `services/api/src/modules/realtime/`

WebSocket theo phiên: nhận transcript final từ STT local, dịch và đẩy bản dịch về client.

## Trách nhiệm

- Xác thực kết nối bằng message `hello`
- Nhận `segment.final` từ STT local; chỉ dịch stream `system`
- Dịch tuần tự mỗi câu final kèm tối đa 3 câu `system` trước và glossary của người dùng
- Trả lỗi theo hợp đồng mà không làm hỏng các câu dịch tiếp theo

## Phạm vi MVP

- F2 — mục tiêu bản dịch p95 ≤ 2,5 giây
- Ngoài phạm vi: audio/STT cloud, lưu segment, ghi event, xác thực production (M3-02),
  reconnect và bộ đệm 60 giây ở server.

## Interface

- `WS /v1/sessions/:id/stream`
- Client → server: `hello`, `segment.final`, `event`
- Server → client: `ready`, `translation`, `error`
- Schema nguồn sự thật: `ClientMessageSchema`, `ServerMessageSchema` trong `@cuelingo/shared`
- MVP chỉ nhận STT local; `hello.sttSource` là `"local"`. Audio/STT cloud chưa thuộc hợp đồng này.
- `hello.token` được xác minh ở tầng WebSocket. M1 chỉ có token phát triển qua
  `REALTIME_DEV_TOKEN`; khi không cấu hình token thì mọi token bị từ chối.

| Biến                   | Bắt buộc | Ý nghĩa                                                              |
| ---------------------- | -------- | -------------------------------------------------------------------- |
| `GEMINI_API_KEY`       | Không    | Thiếu biến này thì không đăng ký route realtime                      |
| `REALTIME_DEV_TOKEN`   | Không    | Token phát triển, tối thiểu 16 ký tự                                 |
| `REALTIME_DEV_USER_ID` | Không    | UUID người dùng phát triển; nếu thiếu dùng profile được tạo sớm nhất |

## Phụ thuộc

- `@cuelingo/ai-gateway`, `@cuelingo/prompts`

## Dữ liệu & sự kiện

- Module không lưu audio hay transcript ở M1.
- Glossary được đọc theo `userId` do bộ xác minh token trả về.
- Mỗi lần gọi AI chỉ log `task`, `model`, `latencyMs`; không log nội dung câu.

## Câu hỏi mở

- Gộp dịch theo cụm khi câu > 25 từ?
