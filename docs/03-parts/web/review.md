# Review

> Phần: [Web app](README.md) · Code: `apps/web/src/features/review/`

Phiên ôn tập FSRS với 3 dạng bài.

## Trách nhiệm

- Nghe → chọn nghĩa; nghĩa tiếng Việt → nói/gõ cụm; nghe câu → điền từ
- Phiên 20 thẻ hoặc 8 phút
- Hiện câu gốc trong cuộc họp kèm audio

## Phạm vi MVP

- US-13 (F5)

## Interface

- `GET /v1/review/queue`, `POST /v1/review/answer`

## Phụ thuộc

- `@cuelingo/ui` (ReviewCard)

## Dữ liệu & sự kiện

- Events: `review_session`, `review_answer`

## Câu hỏi mở

- (chưa có)
