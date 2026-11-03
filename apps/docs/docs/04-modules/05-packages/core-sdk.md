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

- `createClient({baseUrl, getToken})` → `{sessions, assist, review, events, stream}`
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

## Câu hỏi mở

- (chưa có)
