---
title: Brief P2-12 · quyền riêng tư và xuất dữ liệu
---

# Brief — P2-12 · Xoá và xuất dữ liệu cá nhân

> Nhánh `feat/p2-12-codex` · Worktree `.worktrees/p2-12-codex`

## Mục tiêu

API (module `services/api/src/modules/privacy/`, đọc `apps/docs/docs/04-modules/03-api/privacy.md`):

- `DELETE /v1/sessions/:id` → đặt `status='deleted'` (xoá mềm, ẩn khỏi mọi danh sách), 204; session người khác → 404. Module `sessions` hiện có đã lọc `deleted`: kiểm lại.
- `DELETE /v1/me/data` body `{confirm: "XOA DU LIEU"}` → xoá cứng trong một transaction: cuộc họp + segments + debriefs + events + review_logs + `user_lexicon` + `glossary_terms` của chính mình; giữ tài khoản. 204.
- `GET /v1/me/export` → JSON gồm cuộc họp (kèm segments, debrief), cụm từ, thuật ngữ, ngày xuất.
- Mọi route lọc theo `userId`; dev token chấp nhận ở `/v1/me` (`lib/auth.ts`).
- Worker `retention.sweep` (`services/workers/src/jobs/retention`): xoá cứng session `deleted` quá 7 ngày; idempotent.
- Schema Zod mới (`DeleteMyDataRequestSchema`, `ExportSchema`) đặt trong `packages/shared/src/dto/privacy.dto.ts` và export ở `index.ts` (**brief này được phép thêm file này và một dòng export**).

UI:

- **Web** `apps/web/src/app/(app)/settings` (trang đã có do brief trước): mục "Dữ liệu của bạn" với nút "Tải dữ liệu (JSON)" và "Xoá toàn bộ dữ liệu" (hộp xác nhận hai bước, gõ `XOA DU LIEU`).
- **Desktop** trang Cài đặt trong `apps/desktop/src/app/App.tsx` (view `settings`): cùng hai hành động, client riêng `apps/desktop/src/privacy/privacy-api.ts`.
- Trên trang chi tiết cuộc họp web và danh sách "Cuộc họp gần đây" desktop: nút "Xoá cuộc họp" có xác nhận.

## AC

| #   | AC (EARS)                                                                           | Test                         |
| --- | ----------------------------------------------------------------------------------- | ---------------------------- |
| AC1 | Xoá một cuộc họp ẩn nó khỏi danh sách và chi tiết (404), không ảnh hưởng người khác | `privacy.test.ts`            |
| AC2 | `DELETE /v1/me/data` thiếu/sai `confirm` → 400 và không xoá gì                      | test                         |
| AC3 | Xoá dữ liệu xoá đủ các bảng nêu trên của đúng người dùng, user khác nguyên vẹn      | test + `privacy.int.test.ts` |
| AC4 | `GET /v1/me/export` chỉ chứa dữ liệu của chính mình                                 | test                         |
| AC5 | `retention.sweep` xoá cứng session `deleted` quá 7 ngày, chạy lại không đổi kết quả | worker test                  |
| AC6 | UI: xác nhận hai bước, trạng thái đang xoá/lỗi/thành công                           | component test               |

## Phạm vi file

Được sửa/tạo: `services/api/**`, `services/workers/src/jobs/retention/**`, `packages/shared/src/dto/privacy.dto.ts` + một dòng ở `packages/shared/src/index.ts`, `apps/web/src/app/(app)/settings/**` và `apps/web/src/features/**` liên quan, `apps/desktop/src/privacy/**` và `apps/desktop/src/app/App.tsx` (chỉ phần Cài đặt và Cuộc họp gần đây), `apps/desktop/src/session/RecentSessions.tsx`, doc module.

Quy tắc chung: đọc `AGENTS.md` gốc và của thư mục bạn sửa, `apps/docs/docs/05-engineering/agent-collaboration.md`, và mục "Giai đoạn 2" trong `apps/docs/docs/02-product/06-backlog.md`. Không có mạng, không `pnpm add`, không commit/push; dependency đã cài sẵn. Không sửa `packages/ui/src/lib/roadmap.ts`, `package.json`, `pnpm-lock.yaml` (lead sửa khi gộp). Thiết kế giao diện: dùng component của `@cuelingo/ui` và các skill thiết kế trong `.claude/skills/` (design-taste-frontend phần app screen, frontend-design): màu chỉ dành cho dữ liệu, không gradient, không thẻ icon giống nhau, nhãn câu thường. Chạy `pnpm verify` trước khi báo; điền mục Kết quả.

## Kết quả _(implementer điền)_
