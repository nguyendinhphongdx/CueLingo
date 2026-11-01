# Debrief

> Phần: [API service](./README.md) · Code: `services/api/src/modules/debrief/`

Đọc kết quả debrief do worker tạo, nhận phản hồi.

## Trách nhiệm

- Trả phiên bản debrief cao nhất của một session
- Nhận feedback từng khối và ghi event học tập append-only

## Phạm vi MVP

- F4

## Interface

| Endpoint                         | Kết quả                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| `GET /v1/sessions/:id/debrief`   | `Debrief` có `version` cao nhất; chưa có hoặc không sở hữu → `404` |
| `POST /v1/debriefs/:id/feedback` | Nhận `DebriefFeedbackRequest`, ghi event và trả `204`              |

## Phụ thuộc

- `@cuelingo/shared`
- Bảng `sessions` để giữ ranh giới người dùng

## Dữ liệu & sự kiện

- Đọc bảng `debriefs` qua quan hệ `sessions.user_id`.
- Feedback ghi bảng `events` với loại `debrief_feedback`; payload gồm `block`, `useful`.

## Câu hỏi mở

- (chưa có)
