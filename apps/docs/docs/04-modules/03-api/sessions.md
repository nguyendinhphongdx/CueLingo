# Sessions

> Phần: [API service](./README.md) · Code: `services/api/src/modules/sessions/`

Vòng đời cuộc họp: tạo, kết thúc, liệt kê, transcript.

## Trách nhiệm

- Tạo và liệt kê phiên của người dùng hiện tại
- Kết thúc phiên idempotent; lần chuyển sang `ended` enqueue đúng một job debrief
- Trả chi tiết phiên và transcript song ngữ theo thứ tự thời gian
- Cung cấp store kiểm tra ownership để realtime lưu segment và bản dịch

## Phạm vi MVP

- F2, F4

## Interface

| Endpoint                    | Kết quả                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `POST /v1/sessions`         | Tạo `Session` trạng thái `live` và ghi event `session_started` trong **cùng câu lệnh** (đo họp/tuần, D1, D7) |
| `POST /v1/sessions/:id/end` | Trả `Session` trạng thái `ended`; gọi lại không tạo thêm job                                                 |
| `GET /v1/sessions`          | `SessionList`, mới nhất trước                                                                                |
| `GET /v1/sessions/:id`      | `SessionDetail`, segment tăng dần theo `startMs`                                                             |

Tài nguyên không thuộc người dùng hiện tại trả `404`.

## Phụ thuộc

- `lib/queue` → job `debrief.generate`
- `workers/debrief-job`

## Dữ liệu & sự kiện

- Bảng `sessions`, `segments`; mọi truy vấn lọc theo `user_id`.
- Bảng `speakers` (`session_id`, `label` `me`/`speaker_1..8`, `display_name`; unique `(session_id, label)`): `saveSegment` upsert hàng người nói trong cùng câu SQL có kiểm `sessions.user_id`, rồi gán `segments.speaker_id`. Đổi tên ở [speakers](./speakers.md). Không lưu mẫu giọng hay vân giọng.
- `SessionDetail` trả `speakers[]` {id, label, displayName} và `speakerId` ở từng segment (null: không tách được người, hiện theo `source`).
- Realtime chỉ ghi `segments` khi `session_id` thuộc `user_id`; không lưu audio.

## Tạo lại debrief

`POST /v1/sessions/:id/debrief` (không body, `userId` từ auth) xếp lại job debrief cho phiên đã kết thúc có ít nhất một câu: `202 {"queued": true}` (chỉ nghĩa là đã xếp job, client vẫn phải hỏi lại kết quả); `404` phiên không tồn tại hoặc của người khác; `409` phiên còn `live` hoặc không có câu nào; `429` quá 3 yêu cầu/phút/người dùng. Dùng cùng khoá chống trùng với `POST /v1/sessions/:id/end` nên bấm lặp không tạo hai debrief song song. Client: `client.regenerateDebrief(sessionId)`.

## Câu hỏi mở

- (chưa có)
