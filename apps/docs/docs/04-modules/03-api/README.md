# API service

> Code: `services/api/` · Stack: Node.js + Fastify (TypeScript), WebSocket, Postgres (pgvector), pg-boss · Giai đoạn: MVP

Backend modular monolith: REST + realtime WebSocket, điều phối dịch, Learner Model, ôn tập, quyền riêng tư.

## Modules

| Module                                  | Code                     | Trách nhiệm                                                                                      |
| --------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| [Auth](./auth.md)                       | `src/modules/auth`       | Xác thực người dùng và cấp token ngắn hạn cho stream.                                            |
| [Sessions](./sessions.md)               | `src/modules/sessions`   | Vòng đời cuộc họp: tạo, kết thúc, liệt kê, transcript.                                           |
| [Realtime gateway](./realtime.md)       | `src/modules/realtime`   | WebSocket theo phiên: nhận transcript (hoặc audio), dịch từng câu final, đẩy bản dịch về client. |
| [Transcribe](./transcribe.md)           | `src/modules/transcribe` | Nhận dạng giọng nói bằng đám mây cho ngôn ngữ chưa có model trên máy (tiếng Việt).               |
| [Follow-up](./followup.md)              | `src/modules/followup`   | Soạn bản nháp tin follow-up (email, tin nhắn nhóm) từ debrief.                                   |
| [Assist](./assist.md)                   | `src/modules/assist`     | Tra từ theo ngữ cảnh, recap, compose (Việt → Anh).                                               |
| [Debrief](./debrief.md)                 | `src/modules/debrief`    | Đọc kết quả debrief do worker tạo, nhận phản hồi.                                                |
| [Phrases & review](./phrases-review.md) | `src/modules/review`     | Phrase Bank và hàng đợi ôn tập FSRS.                                                             |
| [Learner Model service](./learner.md)   | `src/modules/learner`    | Nguồn sự thật về người học: profile, lexicon, kỹ năng; áp dụng event thành cập nhật.             |
| [Progress](./progress.md)               | `src/modules/progress`   | Tổng hợp chỉ số tiến bộ theo tuần.                                                               |
| [Speakers](./speakers.md)               | `src/modules/speakers`   | Đổi tên người nói của một cuộc họp (nhãn do desktop cấp, lưu ở `speakers`).                      |
| [Glossary](./glossary.md)               | `src/modules/glossary`   | CRUD thuật ngữ cá nhân; cung cấp glossary cho realtime và STT.                                   |
| [Privacy](./privacy.md)                 | `src/modules/privacy`    | Xoá dữ liệu, thời hạn lưu, xuất dữ liệu, consent.                                                |
| [Settings](./settings.md)               | `src/modules/settings`   | Đọc và cập nhật cài đặt cá nhân dùng chung giữa web và desktop.                                  |
| [Events](./events.md)                   | `src/modules/events`     | Nhận và kiểm tra event học tập/sản phẩm, ghi vào bảng `events` (append-only).                    |
| [Admin metrics](./admin.md)             | `src/modules/admin`      | Số liệu vận hành tổng hợp cho email nội bộ trong allowlist.                                      |

## Quan hệ với phần khác

Xem [sơ đồ hệ thống](../../01-overview/04-system-overview.md).
