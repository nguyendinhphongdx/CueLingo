# Privacy

> Phần: [API service](./README.md) · Code: `services/api/src/modules/privacy/`

Xoá mềm cuộc họp, xoá dữ liệu cá nhân và xuất bản sao dữ liệu.

## Trách nhiệm

- Xoá mềm một cuộc họp; mọi API danh sách/chi tiết ẩn phiên đã xoá
- Xoá cứng toàn bộ dữ liệu học và cuộc họp của người dùng trong một transaction, giữ tài khoản
- Xuất cuộc họp (segments, người nói kèm tên người dùng đặt, debrief mới nhất), cụm từ và thuật ngữ của người dùng

## Phạm vi MVP

- US-15

## Interface

- `DELETE /v1/sessions/:id` → 204; tài nguyên không thuộc người dùng → 404
- `DELETE /v1/me/data` body `{confirm: "XOA DU LIEU"}` → 204
- `GET /v1/me/export` → `{exportedAt, sessions, phrases, glossaryTerms}`

## Phụ thuộc

- `workers/retention`

## Dữ liệu & sự kiện

- Khi xoá mềm, `sessions.status = 'deleted'` và `ended_at` ghi thời điểm xoá để bắt đầu cửa sổ giữ lại 7 ngày
- Xoá dữ liệu gồm `sessions` (cascade `segments`, `speakers`, `debriefs`), `events`, `review_logs`, `user_lexicon`, `glossary_terms`
- Không xoá `auth_user`, `learner_profiles` hoặc `lexical_items` dùng chung

## Câu hỏi mở

- (chưa có)
