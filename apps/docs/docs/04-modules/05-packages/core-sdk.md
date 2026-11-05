# @cuelingo/core-sdk

> Phần: [Shared packages](./README.md) · Code: `packages/core-sdk/src/`

SDK client dùng chung cho desktop và web: auth, REST, stream phiên, hàng đợi event offline.

## Trách nhiệm

- REST client có kiểu
- Stream client: reconnect, đệm 60 giây, heartbeat
- Hàng đợi event offline, gửi batch

## Phạm vi MVP

- Toàn bộ

## Interface

- `createClient({baseUrl, getToken})` → `{sessions, assist, review, events, stream, glossary, feedback}`
- `client.feedback.send(input)` → `POST /v1/feedback`, trả `{id, createdAt}`
- `createRealtimeClient({url, token, sessionId, assistLevel, onMessage, onState, onError})`
  → `{connect, send, close, state}`
- Trạng thái realtime: `idle | connecting | open | reconnecting | closed`; chỉ `open` sau message
  `ready`
- Mất kết nối: đệm message tối đa 60 giây và reconnect với backoff 0,5–8 giây

## Phụ thuộc

- `@cuelingo/shared`

## Dữ liệu & sự kiện

- (chưa có)

## Transcribe

`client.transcribe(sessionId, input)`: gửi âm thanh một câu cho `POST /v1/sessions/:id/transcribe` ([transcribe](../03-api/transcribe.md)), trả `{ segmentId, text }`.

## Follow-up

`client.followup(sessionId, input)`: gọi `POST /v1/sessions/:id/followup`, trả `{ subject, body, language }` ([followup](../03-api/followup.md)).

`client.regenerateDebrief(sessionId)`: xếp lại debrief ([sessions](../03-api/sessions.md)), trả `{ queued: true }`.

## Câu hỏi mở

- (chưa có)

## Nhận dạng đám mây (`transcribe`)

`client.transcribe(sessionId, input, {signal?, timeoutMs?})` là client duy nhất gọi `POST /v1/sessions/:id/transcribe`; desktop dùng lại qua `transcribeApi(createHttp(...))` thay vì có bản riêng. Hết hạn mặc định 16 giây (`TRANSCRIBE_TIMEOUT_MS`). Lỗi chưa tới server là `ApiError` status 0 với câu cố định ("timed out", "aborted", "failed"): thông báo không bao giờ lặp lại audio hay chữ. Yêu cầu đã bị huỷ trước khi bắt đầu thì không được gửi.
