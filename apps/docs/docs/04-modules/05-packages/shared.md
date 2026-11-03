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

## Follow-up

Hợp đồng `FollowupRequestSchema` (channel, tone), `FollowupResponseSchema` (subject hoặc null, body, language) và mã lỗi `FOLLOWUP_FAILED` (502).

## Ngôn ngữ họp: Anh, Nhật, Hàn, Trung, Việt

`SUPPORTED_LANGUAGES` có năm mục. `ja`, `ko`, `zh`, `vi` đều `recognition: 'cloud'` ([ADR 0014](../../08-adr/0014-cloud-stt-for-vietnamese.md), [ADR 0016](../../08-adr/0016-cloud-stt-for-japanese-korean-chinese.md)); chỉ `en` nhận dạng trên máy. `translates` (có dịch từng câu sang tiếng Việt) và `learnable` (có khối học và ôn tập) là hai cờ độc lập: `ko` và `zh` dịch nhưng không học, `vi` không dịch và không học, `ja` dịch và học. Mỗi mục có `sttHint` (chỉ dẫn viết đúng chữ cho prompt nhận dạng, ví dụ tiếng Trung giản thể) và nhãn tuỳ chọn dạng "Tiếng Nhật · 日本語".

## Câu hỏi mở

- (chưa có)
