# Convention · Event học tập

Event là đầu vào của Learner Model và debrief ([02-architecture/learner-model](../../02-architecture/learner-model.md)). Bảng `events` là append-only, là nguồn sự thật.

| #   | Luật                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tên event `snake_case`, thì quá khứ hoặc danh từ hành động (`phrase_saved`, `lookup`). Catalog duy nhất ở `packages/shared/src/events/`                           |
| 2   | Mỗi event có Zod schema cho `payload` và `version`. Đổi payload → tăng version, không sửa nghĩa version cũ                                                        |
| 3   | `id` do client sinh (UUID v7) để gửi lại an toàn; server ghi idempotent theo `id`                                                                                 |
| 4   | Event không chứa audio, không chứa transcript đầy đủ; tham chiếu `segment_id`                                                                                     |
| 5   | Event mới ảnh hưởng Learner Model → thêm ánh xạ + test trong `packages/learner-model` cùng PR                                                                     |
| 6   | Cập nhật bảng "Event → cập nhật" trong [learner-model](../../02-architecture/learner-model.md) và catalog trong [data-model](../../02-architecture/data-model.md) |
