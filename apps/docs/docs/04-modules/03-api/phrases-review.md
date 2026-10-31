# Phrases & review

> Phần: [API service](./README.md) · Code: `services/api/src/modules/review/`

Phrase Bank và hàng đợi ôn tập FSRS.

## Trách nhiệm

- Lưu cụm từ kèm ngữ cảnh gốc
- Sinh hàng đợi thẻ đến hạn theo dạng bài
- Ghi kết quả, cập nhật FSRS qua `@cuelingo/learner-model`

## Phạm vi MVP

- F5

## Interface

- `POST/GET /v1/phrases`, `GET /v1/review/queue`, `POST /v1/review/answer`

## Phụ thuộc

- `@cuelingo/learner-model`

## Dữ liệu & sự kiện

- Bảng `lexical_items`, `user_lexicon`, `review_logs`

## Câu hỏi mở

- (chưa có)
