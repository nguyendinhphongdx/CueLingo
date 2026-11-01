---
title: Brief M3-06 · api/phrases (Phrase Bank)
---

# Brief — M3-06 · `api/phrases`

> Nhánh `feat/m3-phrases-codex` · Worktree `.worktrees/m3-phrases-codex`

## Mục tiêu

Module `services/api/src/modules/review/` (hoặc `phrases/`, theo thiết kế `04-modules/03-api/phrases-review.md`): `POST /v1/phrases` (SavePhraseRequest → Phrase; lưu vào `lexical_items` (`type='phrase'`, lemma chữ thường đã chuẩn hoá khoảng trắng) và `user_lexicon` (`meaning_vi`, `first_context_segment_id` nếu segment thuộc user, `in_review=true`); lưu lại cùng cụm từ là idempotent, cập nhật nghĩa nếu có), `GET /v1/phrases` (PhraseList của user), `DELETE /v1/phrases/:id` (bỏ khỏi lexicon của user, không xoá `lexical_items`). Repository Postgres + in-memory; ranh giới người dùng.

## AC

| #   | AC (EARS)                                                                     | Test                                     |
| --- | ----------------------------------------------------------------------------- | ---------------------------------------- |
| AC1 | WHEN lưu cụm từ mới THE SYSTEM SHALL tạo item + dòng lexicon `in_review=true` | `phrases.test.ts`                        |
| AC2 | WHEN lưu lại cùng cụm từ (khác hoa/thường) THE SYSTEM SHALL không tạo bản sao | `phrases.test.ts`                        |
| AC3 | User B không thấy/xoá được cụm từ của user A                                  | `phrases.test.ts`, `phrases.int.test.ts` |
| AC4 | Body sai schema → 400; không session → 401                                    | `phrases.test.ts`                        |

## Phạm vi file

Được sửa/tạo: `services/api/**` (module mới, `app.ts`, `server.ts`), doc module. Không sửa `packages/**`, `apps/**`, `infra/**`.

Quy tắc chung: đọc `AGENTS.md` gốc và `AGENTS.md` của thư mục bạn sửa, `apps/docs/docs/05-engineering/agent-collaboration.md`. Không có mạng, không `pnpm add`, không commit/push; dependency đã cài sẵn. Không đổi hợp đồng trong `packages/shared/src/dto/{session,debrief,phrase}.dto.ts` (nếu thật sự thiếu, dừng và ghi câu hỏi). Chạy `pnpm verify` trước khi báo; điền mục Kết quả.

## Kết quả _(implementer điền)_

- Đã triển khai `modules/review` cho `POST/GET/DELETE /v1/phrases`, gồm service chuẩn hoá lemma, repository in-memory/Postgres và wiring trong `app.ts`, `server.ts`, `testing.ts`.
- Postgres upsert `lexical_items(type='phrase')` + `user_lexicon` trong một câu lệnh; lưu lặp lại giữ cùng id, chỉ cập nhật nghĩa khi request có `meaningVi`, đặt `in_review=true`, chỉ gắn segment thuộc user. Xoá chỉ tác động `user_lexicon`.
- Test thêm:
  - `services/api/src/modules/review/phrases.test.ts`: AC1–AC4 qua Fastify injection (5 test).
  - `services/api/test/integration/phrases.int.test.ts`: upsert DB, ranh giới user/segment và giữ `lexical_items` khi xoá.
- File tài liệu đã cập nhật: `apps/docs/docs/04-modules/03-api/phrases-review.md`.
- Kiểm tra:
  - `pnpm verify`: xanh — 35 test files, 155 tests; dependency check không có vi phạm. Chạy bằng Node 22.14 có cảnh báo thấp hơn engine `>=22.19`, nhưng mọi bước đều hoàn tất.
  - `pnpm docs:build`: xanh.
  - Integration Postgres chưa chạy được trong sandbox: Node 22.14 làm `undici` lỗi lúc import; đổi sang Node 23.8 thì Testcontainers báo không có container runtime. Test đã được thêm để CI/máy có Docker chạy.
  - Đã chạy thật luồng HTTP qua Fastify injection trong unit test: lưu → liệt kê → xoá → liệt kê. Thử mở listener TCP để smoke bằng `fetch` bị sandbox chặn IPC socket của `tsx` (`EPERM`).
- Khác brief: không có. Không sửa contract, migration hay file ngoài phạm vi.
- Câu hỏi còn mở: không có.
