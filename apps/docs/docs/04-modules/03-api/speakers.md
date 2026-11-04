# Speakers

> Phần: [API service](./README.md) · Code: `services/api/src/modules/speakers/` · Hồ sơ: `06-delivery/2026-11-04-speaker-labels/`

Đổi tên người nói của một cuộc họp trong debrief. Nhãn (`me`, `speaker_1..8`) do desktop cấp và [realtime](./realtime.md) ghi; module này chỉ đặt `display_name`.

## Trách nhiệm

- Đổi tên hoặc bỏ tên (`null`) một người nói; mọi câu của người đó đọc tên mới qua `GET /v1/sessions/:id`
- `userId` chỉ từ auth; truy vấn join `sessions.user_id`; phiên hoặc người nói của người khác, không tồn tại, phiên đã xoá: 404
- Nhãn `me` không đổi tên được: 400 (luôn hiện "Tôi")
- Không tự tạo lại debrief; web nhắc người dùng bấm `regenerateDebrief` một lần sau khi đổi

## Interface

- `PATCH /v1/sessions/:id/speakers/:speakerId`: body `RenameSpeakerRequestSchema` {displayName: 1–40 ký tự sau trim, hoặc `null`}, trả `RenameSpeakerResponseSchema` {speaker: {id, label, displayName}}
- Client: `client.renameSpeaker(sessionId, speakerId, displayName | null)` trong `@cuelingo/core-sdk`

## Phụ thuộc

- Bảng `speakers` do [sessions](./sessions.md) ghi; repository in-memory dùng chung dữ liệu với repository sessions in-memory

## Dữ liệu & sự kiện

- Bảng `speakers`: chỉ nhãn và tên do người dùng đặt (không vân giọng); xoá cascade theo phiên, nằm trong xuất dữ liệu ([privacy](./privacy.md)); không log tên
- Không có event

## Câu hỏi mở

- Tên chỉ có hiệu lực trong một cuộc họp, không nhớ giữa các cuộc họp (theo spec)
