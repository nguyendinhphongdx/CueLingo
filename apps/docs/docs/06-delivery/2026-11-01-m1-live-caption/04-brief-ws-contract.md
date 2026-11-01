---
title: Brief M1-04 + M1-07 · Hợp đồng WebSocket và client realtime
---

# Brief — M1 · Hợp đồng WebSocket + client realtime

> Giao cho: Codex · Nhánh: `feat/m1-ws-codex` (tách từ `feat/m1-live-caption`) · Worktree: `.worktrees/m1-ws-codex`
> Quy tắc phối hợp: `apps/docs/docs/05-engineering/agent-collaboration.md` · Mốc: [Backlog](../../02-product/06-backlog.md)

## Mục tiêu

Định nghĩa **hợp đồng WebSocket** giữa desktop và API (`@cuelingo/shared`) và dựng **client realtime** trong `@cuelingo/core-sdk`, để Claude làm server (`services/api`, M1-06) và UI desktop nối vào cùng một hợp đồng. Nguồn thiết kế: `apps/docs/docs/03-architecture/04-realtime-pipeline.md` (mục "WebSocket protocol") và `apps/docs/docs/04-modules/03-api/realtime.md`.

## AC phải đạt

| #   | AC (EARS)                                                                                                                                                                                                                                  | Test                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| AC1 | `@cuelingo/shared` xuất `ClientMessageSchema` (union theo `type`: `hello`, `segment.final`, `event`) và `ServerMessageSchema` (`ready`, `translation`, `error`); mọi message sai hình dạng bị Zod từ chối                                  | `packages/shared/src/ws/ws.test.ts`      |
| AC2 | `segment.final` có `segmentId` (uuid), `stream` (`system`\|`mic`), `startMs`, `endMs` (endMs ≥ startMs), `text` (1–2000 ký tự), `words[]` `{text,startMs,endMs}`; `hello` có `sessionId`, `token`, `sttSource: "local"`, `assistLevel` 0–5 | `ws.test.ts`                             |
| AC3 | `translation` có `segmentId`, `textVi`, `hardWords: string[]`; `error` có `code` (thuộc `ErrorCode` hoặc `ws_*` mới thêm ở `ErrorCode`), `retryable: boolean`                                                                              | `ws.test.ts`                             |
| AC4 | WHEN client gọi `connect()` THE SYSTEM SHALL mở WebSocket, gửi `hello`, và chỉ chuyển trạng thái `open` khi nhận `ready`                                                                                                                   | `packages/core-sdk/src/realtime.test.ts` |
| AC5 | WHEN `send` được gọi trong lúc mất kết nối THE SYSTEM SHALL đệm tối đa 60 giây (bỏ message cũ hơn), và gửi lại theo thứ tự sau khi kết nối lại                                                                                             | `realtime.test.ts`                       |
| AC6 | WHEN kết nối đứt ngoài ý muốn THE SYSTEM SHALL thử lại với backoff tăng dần (0,5 s → tối đa 8 s) cho tới khi `close()`; mỗi lần thử lại gửi lại `hello`                                                                                    | `realtime.test.ts`                       |
| AC7 | WHEN nhận message server THE SYSTEM SHALL parse bằng `ServerMessageSchema`; message hỏng bị bỏ qua và báo qua `onError`, không làm sập client                                                                                              | `realtime.test.ts`                       |

## Môi trường (đọc kỹ)

Codex không có mạng. Không cài dependency (`pnpm install`/`add`). `zod` đã có trong `packages/shared`. WebSocket dùng global `WebSocket` (có sẵn ở browser/Tauri/Node 22); client nhận **factory** để test bằng WebSocket giả và đồng hồ giả (`vi.useFakeTimers`). Cần dependency khác → dừng và ghi câu hỏi.

## Đọc trước

- `AGENTS.md` (gốc), `packages/shared/AGENTS.md`, `packages/core-sdk/AGENTS.md`
- Convention: `apps/docs/docs/05-engineering/conventions/shared-contract.md` (luật số 1–6; ws đặt ở `src/ws/`)
- Mẫu: `packages/shared/src/dto/glossary.dto.ts` + `.test.ts`, `packages/core-sdk/src/glossary.ts`, `packages/core-sdk/src/http.ts`
- Mã lỗi: `packages/shared/src/errors/error-code.ts`

## Phạm vi file

| Được sửa / tạo                                                                                                                                                                                                                                                                                                                                                                      | Không được sửa                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `packages/shared/src/ws/**`, `packages/shared/src/index.ts` (chỉ thêm export), `packages/shared/src/errors/error-code.ts` (chỉ thêm mã), `packages/core-sdk/src/realtime.ts`, `realtime.test.ts`, `packages/core-sdk/src/index.ts` (thêm export), `apps/docs/docs/04-modules/03-api/realtime.md` + `04-modules/05-packages/{shared,core-sdk}.md` (Interface), mục Kết quả của brief | `services/**`, `apps/**` (trừ các trang docs bên trái), `package.json`, `pnpm-lock.yaml`, config gốc, `.github/**` |

Không commit, không push.

## Các bước

1. `packages/shared/src/ws/ws.ts`: schema như AC1–AC3, `type` là literal; thêm `ready` `{type:'ready', sessionId}`. Xuất type bằng `z.infer`. `ws.test.ts`: hợp lệ + từng trường hợp sai.
2. Export từ `packages/shared/src/index.ts`; thêm `ws_unauthorized`, `ws_bad_message`, `ws_translation_failed` vào `ErrorCode` (và test nếu có bảng mã).
3. `packages/core-sdk/src/realtime.ts`: `createRealtimeClient({ url, token, sessionId, assistLevel, createSocket?, now?, onMessage, onState, onError })` trả `{ connect, send(msg: ClientMessage), close, state }`; trạng thái `idle|connecting|open|reconnecting|closed`. Logic đệm/backoff nằm trong hàm thuần để test.
4. `realtime.test.ts` cho AC4–AC7 với socket giả.
5. Cập nhật trang docs module (Interface: hàm và type đã có; ghi `WS /v1/sessions/:id/stream` và các message).
6. `pnpm verify` xanh ở gốc worktree.

## Definition of Done

- [ ] AC1–AC7 có test và xanh · `pnpm verify` xanh
- [ ] Không import framework vào `shared`; `core-sdk` không import `apps/*`
- [ ] Docs module cập nhật · không commit, không push

## Ngoài phạm vi · Dừng và hỏi khi

- Ngoài phạm vi: server WebSocket, STT cloud (`audio` binary), xác thực phía server, UI.
- Dừng và ghi câu hỏi nếu: cần sửa file ngoài danh sách · cần dependency mới · thiết kế message trong docs mâu thuẫn nhau.

## Kết quả _(implementer điền)_

- File đã đổi:
- Test đã thêm:
- `pnpm verify`:
- Khác brief (và lý do):
- Câu hỏi còn mở:
