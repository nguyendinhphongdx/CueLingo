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
- `segment.final`: `{segmentId, stream, startMs, endMs, text, words, speaker?}` (`speaker` là `SpeakerLabel`, tuỳ chọn; server luôn coi câu `mic` là `me`)
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

## Người nói (speaker-labels)

| Thành phần                                                                   | Nội dung                                                                                                                                |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `SpeakerLabelSchema` (`dto/speaker.dto.ts`)                                  | `me` hoặc `speaker_1`…`speaker_8`; `OtherSpeakerLabelSchema` không gồm `me`; `MAX_SPEAKERS = 8`                                         |
| `SpeakerSchema`, `RenameSpeakerRequestSchema`, `RenameSpeakerResponseSchema` | `{id, label, displayName \| null}`; đổi tên 1–40 ký tự sau trim, `null` để bỏ tên                                                       |
| `TranscribeRequest.knownSpeakers?`                                           | Tối đa 8 mục `{label: speaker_N, hint ≤ 60, lastText ≤ 200}`; có nghĩa là "gắn nhãn người nói"; chỉ nằm trong RAM, không lưu, không log |
| `TranscribeResponse.speaker?`                                                | `{label: speaker_N \| 'new' \| 'unknown', hint? ≤ 60}`; chỉ trả khi request có `knownSpeakers` (bản cũ vẫn parse strict được)           |
| `StoredSegment.speakerId?`                                                   | uuid hoặc null (câu cũ hoặc chưa phân biệt người nói)                                                                                   |
| `SessionDetail.speakers`                                                     | Danh sách `Speaker`, mặc định `[]`                                                                                                      |
| Registry `labelsSpeakers`                                                    | `en: false`; `vi`, `ja`, `ko`, `zh: true` (chỉ ngôn ngữ nhận dạng đám mây)                                                              |

## Câu hỏi mở

- (chưa có)
