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

| Endpoint                    | Kết quả                                                      |
| --------------------------- | ------------------------------------------------------------ |
| `POST /v1/sessions`         | Tạo `Session` trạng thái `live`                              |
| `POST /v1/sessions/:id/end` | Trả `Session` trạng thái `ended`; gọi lại không tạo thêm job |
| `GET /v1/sessions`          | `SessionList`, mới nhất trước                                |
| `GET /v1/sessions/:id`      | `SessionDetail`, segment tăng dần theo `startMs`             |

Tài nguyên không thuộc người dùng hiện tại trả `404`.

## Phụ thuộc

- `lib/queue` → job `debrief.generate`
- `workers/debrief-job`

## Dữ liệu & sự kiện

- Bảng `sessions`, `segments`; mọi truy vấn lọc theo `user_id`.
- Realtime chỉ ghi `segments` khi `session_id` thuộc `user_id`; không lưu audio.

## Câu hỏi mở

- (chưa có)
