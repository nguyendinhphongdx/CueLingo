# Review

> Phần: [Web app](./README.md) · Code: `apps/web/src/features/review/`

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

## Lật thẻ (mặc định) và trắc nghiệm

Trang ôn có hai kiểu, chọn bằng công tắc "Kiểu ôn", nhớ theo trình duyệt (`cuelingo.reviewMode`). **Lật thẻ** là mặc định: chạm hoặc Space để lật, rồi vuốt phải "Được" (3), trái "Lại" (1), lên "Dễ" (4), xuống "Khó" (2). Nút và phím mũi tên/1–4 làm đúng như vậy, nên không cần chuột. Vuốt trước khi lật bị chặn, thẻ bật về chỗ và nhắc lật trước. `prefers-reduced-motion` bỏ hiệu ứng bay và lật. Chấm điểm vẫn là FSRS qua cùng `POST /v1/review/answer`; ở kiểu lật, rating từ 3 trở lên tính là đúng trong tổng kết. Thành phần dùng chung `FlashcardDeck` trong `@cuelingo/ui`.
