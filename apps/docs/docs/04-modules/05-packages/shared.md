# @cuelingo/shared

> Phần: [Shared packages](./README.md) · Code: `packages/shared/src/`

Kiểu domain, schema API/WebSocket (zod), catalog event.

## Trách nhiệm

- Domain types: User, Session, Segment, LexicalItem, Debrief…
- Schema request/response và message WebSocket
- Catalog event + version

## Phạm vi MVP

- Toàn bộ

## Interface

- `ClientMessageSchema` / `ClientMessage`: union strict theo `type` gồm `hello`, `segment.final`, `event`
- `ServerMessageSchema` / `ServerMessage`: union strict theo `type` gồm `ready`, `translation`, `error`
- `segment.final`: `{segmentId, stream, startMs, endMs, text, words}`
- `translation`: `{segmentId, textVi, hardWords}`
- Mã lỗi WebSocket: `ws_unauthorized`, `ws_bad_message`, `ws_translation_failed`

## Phụ thuộc

- zod

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- (chưa có)
