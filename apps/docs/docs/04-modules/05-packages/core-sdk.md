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

- `createClient({baseUrl, getToken})` → `{sessions, assist, review, events, stream, glossary, feedback, conversations, agent}`
- Màn admin (`/v1/admin/*`, gồm `admin.agent.get()` và `admin.agent.update({enabled} | {plugin:{id,enabled}})`) gọi qua client của app web (`apps/web/src/lib/client.ts`), không qua core-sdk: chỉ web admin dùng, schema ở `@cuelingo/shared`
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

## Trợ lý AI (`conversations`, `agent`)

- `client.conversations`: `list()`, `get(id)` → `{conversation, messages}`, `create({language?})`, `rename(id, title)`, `remove(id)`. Mọi phản hồi qua schema của `@cuelingo/shared` ([conversations](../03-api/conversations.md)).
- `client.agent.sendMessage(id, {content, language?}, {signal?, onEvent})` gọi `POST /v1/conversations/:id/messages` ([agent](../03-api/agent.md)) bằng `fetch` + `ReadableStream`, gọi `onEvent` theo thứ tự cho từng `AgentStreamEvent` hợp lệ. Sau `done`, client tự đọc lại `conversations.get(id)`.
- Parser SSE (`sse.ts`) chịu chunk cắt giữa dòng, giữa ký tự UTF-8, giữa `\r` và `\n`; bỏ qua comment, event lạ và dữ liệu sai schema (server mới hơn không làm vỡ client cũ). Frame chưa có dòng trống kết thúc bị bỏ.
- Lỗi trước khi stream (409 `CONFLICT`, 429 `AGENT_QUOTA_EXCEEDED` kèm `details` là `AgentQuota`, 503 `AGENT_DISABLED`, 404, 401) ném `ApiError` giống `request`. Mất mạng giữa chừng, hoặc stream đóng mà chưa có `done`, ném `ApiError(0, 'NETWORK_ERROR')`.
- Huỷ bằng `signal` (nút Dừng) là chủ ý nên `sendMessage` **resolve êm** ở mọi thời điểm (trước khi gửi, giữa stream); server giữ phần chữ đã sinh với trạng thái `stopped`. Lỗi do `onEvent` ném ra được trả nguyên.
- `createHttp` có thêm `stream(method, path, body, {signal})` trả về `Response` đang mở, dùng chung token, `baseUrl`, `credentials` và cách map lỗi với `request`.
