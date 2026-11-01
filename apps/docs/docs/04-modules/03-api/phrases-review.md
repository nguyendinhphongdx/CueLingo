# Phrases & review

> Phần: [API service](./README.md) · Code: `services/api/src/modules/review/`

Phrase Bank và hàng đợi ôn tập FSRS.

## Trách nhiệm

- Lưu cụm từ đã chuẩn hoá kèm ngữ cảnh gốc thuộc người dùng
- Sinh hàng đợi thẻ đến hạn theo dạng bài
- Ghi kết quả, cập nhật FSRS qua `@cuelingo/learner-model`

## Phạm vi MVP

- F5

## Interface

| Method   | Path                | Contract                             | Trạng thái |
| -------- | ------------------- | ------------------------------------ | ---------- |
| `POST`   | `/v1/phrases`       | `SavePhraseRequest` → `Phrase`       | Đã có      |
| `GET`    | `/v1/phrases`       | → `PhraseList`                       | Đã có      |
| `DELETE` | `/v1/phrases/:id`   | → `204`                              | Đã có      |
| `GET`    | `/v1/review/queue`  | Hàng đợi ôn tập                      | Chưa dựng  |
| `POST`   | `/v1/review/answer` | Kết quả ôn tập → trạng thái cập nhật | Chưa dựng  |

## Phụ thuộc

- `@cuelingo/shared` cho contract Phrase Bank
- `@cuelingo/learner-model` cho phần review chưa dựng

## Dữ liệu & sự kiện

- `lexical_items`: một item `type='phrase'` cho mỗi lemma chữ thường, khoảng trắng chuẩn hoá.
- `user_lexicon`: nghĩa tiếng Việt, segment ngữ cảnh đầu tiên thuộc user và `in_review=true`.
- Lưu lặp lại là idempotent; nghĩa mới chỉ thay nghĩa cũ khi request có `meaningVi`.
- Xoá Phrase Bank chỉ xoá dòng `user_lexicon`; giữ lại `lexical_items` dùng chung.
- `review_logs`: dành cho luồng review chưa dựng.

## Câu hỏi mở

- (chưa có)
