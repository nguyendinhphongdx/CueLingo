# Privacy

> Phần: [API service](./README.md) · Code: `services/api/src/modules/privacy/`

Xoá mềm cuộc họp, xoá dữ liệu cá nhân và xuất bản sao dữ liệu.

## Trách nhiệm

- Xoá mềm một cuộc họp; mọi API danh sách/chi tiết ẩn phiên đã xoá
- Xoá cứng toàn bộ dữ liệu học và cuộc họp của người dùng trong một transaction, giữ tài khoản
- Xuất cuộc họp (segments, người nói kèm tên người dùng đặt, debrief mới nhất), cụm từ, thuật ngữ và hội thoại với trợ lý AI (chưa xoá, kèm tin nhắn) của người dùng

## Phạm vi MVP

- US-15

## Interface

- `DELETE /v1/sessions/:id` → 204; tài nguyên không thuộc người dùng → 404
- `DELETE /v1/me/data` body `{confirm: "XOA DU LIEU"}` → 204
- `GET /v1/me/export` → `{exportedAt, sessions, phrases, glossaryTerms, conversations}`; `conversations` là `ConversationDetail[]` (mới cập nhật trước), server cũ không có trường này nên schema mặc định `[]`

## Phụ thuộc

- `workers/retention`

## Dữ liệu & sự kiện

- Khi xoá mềm, `sessions.status = 'deleted'` và `ended_at` ghi thời điểm xoá để bắt đầu cửa sổ giữ lại 7 ngày
- Xoá dữ liệu gồm `sessions` (cascade `segments`, `speakers`, `debriefs`), `events`, `review_logs`, `user_lexicon` (gồm `context_text`), `glossary_terms`, `agent_messages`, `agent_conversations` (cả hội thoại đã xoá mềm; cùng transaction, không chờ 7 ngày)
- Xoá một hội thoại (`DELETE /v1/conversations/:id`) là xoá mềm, xem [conversations](./conversations.md); `retention.sweep` xoá cứng sau 7 ngày. Xoá hội thoại không xoá cụm từ đã lưu từ hội thoại đó.
- Không xoá `usage_counters`, `user_plans` (lượng dùng tính theo gói, chỉ có con số; [ADR 0022](../../08-adr/0022-usage-survives-data-delete.md)) và `billing_orders` (chứng từ thu tiền; [ADR 0023](../../08-adr/0023-payments-payos-vietqr.md)); xoá tài khoản thì xoá. Test: `privacy.test.ts`, `privacy.repository.test.ts`, `privacy.int.test.ts`
- Không xoá `auth_user`, `learner_profiles` hoặc `lexical_items` dùng chung

## Câu hỏi mở

- (chưa có)

## Dữ liệu mục tiêu

`deleteMyData` xoá `lesson_reports`, `goal_lessons`, `learning_goals` của người dùng trước `review_logs`; không xoá `lesson_contents` (nội dung chung, không có `user_id`). Mục tiêu không nằm trong export. Câu luyện gõ không được lưu nên không có gì để xoá. Xem [goals](./goals.md).

## Trợ lý trong cuộc họp

`DELETE /v1/me/data` xoá `meeting_questions` và `meeting_assist_consents` trong cùng transaction. `GET /v1/me/export` giữ nguyên hình dạng; thêm `?include=meeting_questions` thì mỗi phiên có thêm `questions` (desktop ≤ 0.1.12 từ chối khoá lạ).
