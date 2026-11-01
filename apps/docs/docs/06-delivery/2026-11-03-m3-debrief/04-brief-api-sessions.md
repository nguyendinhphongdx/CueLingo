---
title: Brief M3-01 · api/sessions + đọc debrief + lưu segments
---

# Brief — M3-01 · `api/sessions`, `api/debrief` (đọc), lưu segments realtime

> Nhánh `feat/m3-sessions-codex` · Worktree `.worktrees/m3-sessions-codex`

## Mục tiêu

1. `services/api/src/modules/sessions/` (copy cấu trúc `glossary`, repository Postgres + in-memory): `POST /v1/sessions` (CreateSessionRequest → Session, status `live`), `POST /v1/sessions/:id/end` (đặt `ended_at`, status `ended`, gửi job `debrief.generate` qua `queue`; gọi lại là idempotent), `GET /v1/sessions` (SessionList, mới nhất trước), `GET /v1/sessions/:id` (SessionDetail kèm segments theo `start_ms`). Mọi truy vấn lọc theo `userId`; session của người khác → 404.
2. `services/api/src/modules/debrief/`: `GET /v1/sessions/:id/debrief` (bản `version` cao nhất, trả `Debrief`; chưa có → 404 mã `NotFound`), `POST /v1/debriefs/:id/feedback` (DebriefFeedbackRequest, 204; ghi một event học tập loại `debrief_feedback` vào bảng `events` hoặc cột phù hợp — xem module events).
3. Lưu segments: module `realtime` hiện chỉ dịch. Thêm `RealtimeDeps.store?` (`saveSegment({sessionId,userId,segmentId,source,startMs,endMs,textEn})`, `saveTranslation(segmentId, textVi)`); service gọi khi nhận `segment.final` (cả mic) và khi có bản dịch; lỗi lưu chỉ log, không làm hỏng luồng. Khi `hello.sessionId` chưa tồn tại hoặc không thuộc user → `error` `ws_unauthorized`? Không: nếu session không tồn tại thì bỏ qua lưu (giữ tương thích với dev); chỉ lưu khi session thuộc đúng user. Không lưu audio.
4. Đăng ký trong `app.ts`/`server.ts`; doc `04-modules/03-api/{sessions,debrief}.md`.

## AC

| #   | AC (EARS)                                                                                                               | Test                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| AC1 | WHEN tạo session THE SYSTEM SHALL trả Session `live` thuộc user hiện tại                                                | `sessions.test.ts`                                          |
| AC2 | WHEN kết thúc session THE SYSTEM SHALL đặt `ended` một lần và enqueue đúng một job `debrief.generate` kể cả khi gọi lại | `sessions.test.ts`                                          |
| AC3 | Session của user khác THE SYSTEM SHALL trả 404 cho GET/end/debrief                                                      | `sessions.test.ts`                                          |
| AC4 | WHEN `segment.final` + translation đến qua WS cho session của user THE SYSTEM SHALL lưu `text_en` rồi `text_vi`         | `realtime.test.ts`                                          |
| AC5 | Lỗi lưu không làm đứt WS và không chặn bản dịch                                                                         | `realtime.test.ts`                                          |
| AC6 | Debrief đọc trả đúng phiên bản mới nhất; feedback sai schema → 400                                                      | `debrief.test.ts`                                           |
| AC7 | Repository Postgres giữ ranh giới người dùng                                                                            | `sessions.int.test.ts` (viết, có thể không chạy được local) |

## Phạm vi file

Được sửa/tạo: `services/api/**`, doc module. Không sửa: `packages/**`, `apps/**`, `infra/**` (nếu cần migration, dừng và hỏi), `package.json`, lockfile.

Quy tắc chung: đọc `AGENTS.md` gốc và `AGENTS.md` của thư mục bạn sửa, `apps/docs/docs/05-engineering/agent-collaboration.md`. Không có mạng, không `pnpm add`, không commit/push; dependency đã cài sẵn. Không đổi hợp đồng trong `packages/shared/src/dto/{session,debrief,phrase}.dto.ts` (nếu thật sự thiếu, dừng và ghi câu hỏi). Chạy `pnpm verify` trước khi báo; điền mục Kết quả.

## Kết quả _(implementer điền)_

### Đã làm

- Hoàn thiện module `sessions`: repository Postgres/in-memory, service, routes và test cho tạo,
  kết thúc idempotent, danh sách mới nhất trước, chi tiết kèm segment và ranh giới người dùng.
- Hoàn thiện module `debrief`: đọc phiên bản cao nhất, nhận feedback `204`, ghi event
  `debrief_feedback` và trả `404` cho dữ liệu không thuộc người dùng.
- Mở rộng realtime store: lưu segment final của cả `system`/`mic`, cập nhật `text_vi` sau khi
  dịch; session thiếu/khác user thì chỉ dịch, không lưu; lỗi lưu chỉ log.
- Đăng ký repository/module trong `app.ts`, `server.ts`, `testing.ts`; cập nhật integration setup
  auth và tài liệu `sessions`, `debrief`, `realtime`.

### Test đã thêm

- `services/api/src/modules/sessions/sessions.test.ts`: AC1–AC3, validation và auth.
- `services/api/src/modules/debrief/debrief.test.ts`: AC3, AC6 và feedback ownership.
- `services/api/src/modules/realtime/realtime.test.ts`: AC4–AC5, gồm session không hợp lệ.
- `services/api/test/integration/sessions.int.test.ts`: AC7 với repository Postgres.

### Kiểm tra

- `pnpm verify`: xanh — 36 file test, 161 test; không có vi phạm dependency.
- `pnpm docs:build`: xanh.
- Smoke flow bằng app thật trong process: tạo session `201` → end `ended` → detail `200`;
  queue nhận đúng một `debrief.generate`.
- Integration Postgres đã thử nhưng không chạy được trong sandbox: Docker socket bị từ chối;
  môi trường dùng Node `22.14.0` trong khi repo yêu cầu `>=22.19` và `.nvmrc` là 24 (chưa cài).

### Khác brief và câu hỏi mở

- Không cần migration hoặc sửa contract; schema/DTO hiện có đã đủ.
- Không có câu hỏi mở.
