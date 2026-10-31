# API service

> Code: `services/api/` · Stack: Node.js + Fastify (TypeScript), WebSocket, Postgres (pgvector), pg-boss · Giai đoạn: MVP

Backend modular monolith: REST + realtime WebSocket, điều phối dịch, Learner Model, ôn tập, quyền riêng tư.

## Modules

| Module                                  | Code                   | Trách nhiệm                                                                                      |
| --------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| [Auth](./auth.md)                       | `src/modules/auth`     | Xác thực người dùng và cấp token ngắn hạn cho stream.                                            |
| [Sessions](./sessions.md)               | `src/modules/sessions` | Vòng đời cuộc họp: tạo, kết thúc, liệt kê, transcript.                                           |
| [Realtime gateway](./realtime.md)       | `src/modules/realtime` | WebSocket theo phiên: nhận transcript (hoặc audio), dịch từng câu final, đẩy bản dịch về client. |
| [Assist](./assist.md)                   | `src/modules/assist`   | Tra từ theo ngữ cảnh, recap, compose (Việt → Anh).                                               |
| [Debrief](./debrief.md)                 | `src/modules/debrief`  | Đọc kết quả debrief do worker tạo, nhận phản hồi.                                                |
| [Phrases & review](./phrases-review.md) | `src/modules/review`   | Phrase Bank và hàng đợi ôn tập FSRS.                                                             |
| [Learner Model service](./learner.md)   | `src/modules/learner`  | Nguồn sự thật về người học: profile, lexicon, kỹ năng; áp dụng event thành cập nhật.             |
| [Progress](./progress.md)               | `src/modules/progress` | Tổng hợp chỉ số tiến bộ theo tuần.                                                               |
| [Glossary](./glossary.md)               | `src/modules/glossary` | CRUD thuật ngữ cá nhân; cung cấp glossary cho realtime và STT.                                   |
| [Privacy](./privacy.md)                 | `src/modules/privacy`  | Xoá dữ liệu, thời hạn lưu, xuất dữ liệu, consent.                                                |
| [Events](./events.md)                   | `src/modules/events`   | Nhận và kiểm tra event học tập/sản phẩm, ghi vào bảng `events` (append-only).                    |

## Quan hệ với phần khác

Xem [sơ đồ hệ thống](../../01-overview/04-system-overview.md).
