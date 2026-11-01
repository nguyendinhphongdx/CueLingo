---
title: Brief M1-06 · api/realtime (WebSocket server)
---

# Brief — M1-06 · `services/api` realtime WebSocket

> Giao cho: Codex · Nhánh `feat/m1-api-codex` · Worktree `.worktrees/m1-api-codex` · Quy tắc: `apps/docs/docs/05-engineering/agent-collaboration.md` · ADR: `08-adr/0012-realtime-transport.md`

## Mục tiêu

Thêm module `services/api/src/modules/realtime/` (copy cấu trúc module mẫu `glossary`): WebSocket `GET /v1/sessions/:id/stream` theo hợp đồng `@cuelingo/shared` (`ClientMessageSchema`/`ServerMessageSchema`, thư mục `packages/shared/src/ws`). Mỗi `segment.final` của luồng `system` được dịch bằng `@cuelingo/ai-gateway` (`gateway.llm('translate.realtime', { text, previous, glossary })`) rồi trả `translation`. Thiết kế: `apps/docs/docs/03-architecture/04-realtime-pipeline.md`, `04-modules/03-api/realtime.md`.

## AC

| #   | AC (EARS)                                                                                                                                                                                                   | Test                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| AC1 | WHEN client gửi `hello` hợp lệ và `verifyToken(token)` trả userId THE SYSTEM SHALL trả `ready`; IF token sai THEN gửi `error` `ws_unauthorized` (retryable=false) rồi đóng                                  | `realtime.test.ts`         |
| AC2 | IF message không qua `ClientMessageSchema` THEN gửi `error` `ws_bad_message` (retryable=false) và giữ kết nối                                                                                               | `realtime.test.ts`         |
| AC3 | WHEN nhận `segment.final` stream `system` THE SYSTEM SHALL gọi dịch với tối đa 3 câu `system` trước đó của phiên làm ngữ cảnh và glossary của user, rồi gửi `translation` `{segmentId,textVi,hardWords:[]}` | `realtime.test.ts`         |
| AC4 | WHEN `segment.final` có stream `mic` THE SYSTEM SHALL không dịch (chỉ nhớ làm ngữ cảnh nếu cần), không gửi gì                                                                                               | `realtime.test.ts`         |
| AC5 | IF gateway lỗi THEN gửi `error` `ws_translation_failed` (retryable=true) kèm không đóng kết nối; các câu sau vẫn được dịch                                                                                  | `realtime.test.ts`         |
| AC6 | Bản dịch trả về theo đúng thứ tự `segment.final` nhận được cho cùng một kết nối                                                                                                                             | `realtime.test.ts`         |
| AC7 | `GET /healthz` và route cũ không đổi; `pnpm test:int` không hỏng                                                                                                                                            | `pnpm verify`, `test:int`* |

*`test:int` cần Docker + Node ≥ 22.19; nếu không chạy được trong môi trường của bạn, ghi rõ ở Kết quả.

## Thiết kế bắt buộc

- `buildApp(deps)` nhận thêm `realtime?: { gateway: Pick<AiGateway,'llm'>; verifyToken(token: string): Promise<string|null>; glossary(userId): Promise<{term;translation}[]> }`; khi có thì đăng ký module. Test dùng gateway giả (không gọi mạng).
- `server.ts`: tạo gateway thật từ `config.GEMINI_API_KEY` (thêm biến **tuỳ chọn** vào `config.ts` và `.env.example`; thiếu thì không bật realtime, log cảnh báo); `verifyToken` dev: chấp nhận `REALTIME_DEV_TOKEN` (biến tuỳ chọn, tối thiểu 16 ký tự) trả userId của người dùng đầu tiên trong `learner_profiles` hoặc userId cố định `REALTIME_DEV_USER_ID` (uuid). Production chưa nối (M3-02): không đặt biến thì mọi token bị từ chối.
- Glossary lấy từ repository `glossary` có sẵn.
- Dùng `@fastify/websocket` (đã cài). Log mỗi lần dịch qua `onCall` của gateway ở mức info (task, model, latencyMs), **không log nội dung câu**.
- Không import SDK AI trực tiếp (chỉ `@cuelingo/ai-gateway`).

## Môi trường

Codex không có mạng; dependency đã cài sẵn (`@fastify/websocket`, `@types/ws`, `@cuelingo/ai-gateway`, `@cuelingo/prompts` trong `services/api`). Không `pnpm add`. Không gọi API Gemini thật trong test.

## Đọc trước

`AGENTS.md` gốc, `services/api/AGENTS.md`, `apps/docs/docs/05-engineering/workflows/new-module.md`, module `services/api/src/modules/glossary/`, `services/api/src/app.ts`, `src/testing.ts`, `packages/ai-gateway/src/index.ts`, `packages/shared/src/ws/`.

## Phạm vi file

Được sửa/tạo: `services/api/**` (module mới, `app.ts`, `server.ts`, `config.ts` + test, `.env.example`), `apps/docs/docs/04-modules/03-api/realtime.md`, mục Kết quả. Không sửa: `packages/**`, `apps/**`, `infra/**`, `pnpm-lock.yaml`, `package.json`. Không commit/push.

## Kết quả _(implementer điền)_

- File đã đổi:
  - `.env.example`
  - `services/api/src/{app,config,config.test,server}.ts`, `services/api/src/lib/auth.ts`
  - `services/api/src/modules/realtime/{index,realtime.routes,realtime.service,realtime.test}.ts`
  - `apps/docs/docs/04-modules/03-api/realtime.md`
  - Brief này (mục Kết quả)
- Test đã thêm:
  - 8 test WebSocket cho xác thực/đóng kết nối, message sai, context + glossary,
    stream mic, phục hồi lỗi gateway, thứ tự bản dịch và regression route cũ.
  - 2 test config cho các biến realtime tuỳ chọn và giá trị không hợp lệ.
- `pnpm verify` / `test:int`:
  - `pnpm verify`: xanh (26 file test, 101 test; không vi phạm dependency).
  - `pnpm docs:build`: xanh.
  - `pnpm test:int`: không chạy được test; 4 suite lỗi khi import `undici`
    (`decompress.js:78`, `TypeError: Cannot read properties of undefined (reading 'bind')`). Môi trường
    đang dùng Node 22.14.0, thấp hơn Node >= 22.19 mà repo/Testcontainers yêu cầu.
  - Đã chạy luồng WebSocket qua Fastify `injectWS` với gateway giả; không gọi Gemini thật.
- Khác brief: Không.
- Câu hỏi còn mở: Không.
