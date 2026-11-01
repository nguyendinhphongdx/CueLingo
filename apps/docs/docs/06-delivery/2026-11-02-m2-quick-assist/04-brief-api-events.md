---
title: Brief M2-06 · api/events
---

# Brief — M2-06 · `api/events` (event học tập, append-only)

> Giao cho: Codex · Nhánh `feat/m2-events-codex` · Worktree `.worktrees/m2-events-codex` · Quy tắc: `apps/docs/docs/05-engineering/agent-collaboration.md`

## Mục tiêu

`POST /v1/events` nhận `PostEventsRequest` (`packages/shared/src/dto/events.dto.ts`, đừng đổi) và ghi từng event vào bảng `events` (xem `infra/db/migrations/20261101090000_init.sql`; nếu bảng thiếu cột cần thiết, thêm một migration mới dưới `infra/db/migrations/` theo ADR 0009 và có rollback). Copy cấu trúc module `glossary` (routes → service → repository Postgres + repository trong bộ nhớ cho test).

## AC

| #   | AC (EARS)                                                                                                         | Test                 |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------------- |
| AC1 | WHEN gửi 1–100 event hợp lệ THE SYSTEM SHALL ghi tất cả với `user_id` lấy từ session (không từ body) và trả `204` | `events.test.ts`     |
| AC2 | IF một event sai schema THEN `400` và không ghi event nào                                                         | `events.test.ts`     |
| AC3 | Bảng chỉ thêm, không có route sửa/xoá event                                                                       | `events.test.ts`     |
| AC4 | Repository Postgres ghi đúng và giữ ranh giới người dùng                                                          | `events.int.test.ts` |
| AC5 | Không có session THEN `401`                                                                                       | `events.test.ts`     |

## Thiết kế bắt buộc

- Đăng ký trong `app.ts` qua `deps.repos.events`, nối `server.ts`. Không sửa `lib/auth.ts` (brief khác đang sửa).
- Doc: cập nhật `apps/docs/docs/04-modules/03-api/events.md`.

## Môi trường / phạm vi file

Không có mạng, không `pnpm add`. Được sửa/tạo: `services/api/**` (trừ `lib/auth.ts`, `lib/errors.ts`), `infra/db/migrations/**`, doc module. Không sửa: `packages/**`, `apps/**` (ngoài doc), `package.json`, lockfile. Không commit/push. `test:int` cần Docker + Node ≥ 22.19; nếu không chạy được, ghi rõ. Chạy `pnpm verify`.

## Kết quả _(implementer điền)_
