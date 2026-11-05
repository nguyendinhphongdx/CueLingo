# Events

> Phần: [API service](./README.md) · Code: `services/api/src/modules/events/`

Nhận và kiểm tra event học tập/sản phẩm, ghi vào bảng `events` (append-only).

## Trách nhiệm

- Validate theo catalog trong `@cuelingo/shared/events`
- Gắn `user_id` từ session và ghi nguyên batch trong một transaction
- Chặn tham chiếu `sessionId` hoặc `segmentId` thuộc người dùng khác
- Event kích hoạt beta: `app_installed_first_run` và `first_caption_shown` (desktop gửi, mỗi người **một lần**: gửi lại bị bỏ), không chứa chữ nào của caption. `session_started` do **API** ghi trong cùng câu lệnh tạo phiên (xem [sessions](./sessions.md)), client không gửi được.
- `assist_suggestion.language` chỉ nhận ngôn ngữ học được (`LearnableLanguageSchema`); `vi` bị từ chối.
- Ba event kích hoạt **không** cập nhật Learner Model.

## Phạm vi MVP

- Toàn bộ

## Interface

- `POST /v1/events`: nhận 1–100 event hợp lệ, trả `204`; batch sai schema trả `400`
- Không có route sửa hoặc xoá event

## Phụ thuộc

- `@cuelingo/shared`

## Dữ liệu & sự kiện

- Bảng `events`: append-only; UUID nội bộ do API sinh
- `sessionId` và `segmentId` được lưu ở cột riêng; dữ liệu theo từng loại nằm trong `payload`

## Câu hỏi mở

- `events.id` do API sinh (`randomUUID()`), không phải client như quy ước trong [data-model](../../03-architecture/07-data-model.md): gửi lại có thể trùng. Số liệu beta dùng `MIN(at)` / `DISTINCT` nên miễn nhiễm; hai event kích hoạt còn được chặn trùng ở repository.
