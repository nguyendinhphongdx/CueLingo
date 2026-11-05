# Conversations

> Phần: [API service](./README.md) · Code: `services/api/src/modules/conversations/` · Hồ sơ: [ai-agent](../../06-delivery/2026-11-05-ai-agent/02-plan.md)

Hội thoại với trợ lý AI và các tin nhắn của chúng: danh sách, đọc, tạo, đổi tên, xoá mềm. Một lượt trả lời (stream, công cụ, quota) nằm ở [Agent](./agent.md); module đó ghi tin qua repository của module này.

## Trách nhiệm

- CRUD hội thoại của chính người dùng; hội thoại của người khác luôn là `404`, không phải `403`
- Ghi tin nhắn (user, assistant) với `seq` tăng dần trong hội thoại; tiêu đề lấy từ 60 ký tự đầu của tin đầu tiên (không gọi AI)
- Xoá mềm: `DELETE` đặt `deleted_at`, mọi đường đọc/ghi ẩn ngay; `retention.sweep` xoá cứng sau 7 ngày ([retention](../04-workers/retention.md))
- Khi đọc, tin `streaming` quá 10 phút (tiến trình đã chết) được trả là `error`

## Phạm vi MVP

- Lô 1 của ai-agent; US-15 cho xoá.

## Interface

| Method   | Path                    | Contract                                                         |
| -------- | ----------------------- | ---------------------------------------------------------------- |
| `GET`    | `/v1/conversations`     | → `ConversationList` (chưa xoá, mới cập nhật nhất trước, ≤ 100)  |
| `POST`   | `/v1/conversations`     | `CreateConversationRequest` (`{language?}`, mặc định `en`) → 201 |
| `GET`    | `/v1/conversations/:id` | → `ConversationDetail` (`{conversation, messages}`, cũ → mới)    |
| `PATCH`  | `/v1/conversations/:id` | `RenameConversationRequest` (`{title}`, 1–120) → `Conversation`  |
| `DELETE` | `/v1/conversations/:id` | → 204; đã xoá hoặc của người khác → 404                          |

Contract ở `packages/shared/src/dto/agent.dto.ts`.

## Phụ thuộc

- `@cuelingo/shared`. Postgres (`agent_conversations`, `agent_messages`).

## Dữ liệu & sự kiện

- `agent_conversations(id, user_id, title, language, created_at, updated_at, deleted_at)`; `agent_messages(id, conversation_id, user_id, seq, role, parts jsonb, status, prompt_version, input_tokens, output_tokens, created_at)`, `unique(conversation_id, seq)`. Xem [data model](../../03-architecture/07-data-model.md).
- Mọi query lọc theo `user_id`; ghi tin chỉ thành công khi hội thoại thuộc người dùng và chưa xoá.
- Không log nội dung tin nhắn. Không phát event.
- Xoá dữ liệu cá nhân và export: [privacy](./privacy.md).

## Câu hỏi mở

- Phân trang tin nhắn (hiện đọc tối đa 500 tin, một lượt không tới mức đó).
