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

## Ba tab: Hôm nay, Kho cụm từ, Tiến độ

Ôn tập là một mục với ba tab, danh sách tab lấy từ `REVIEW_TABS` trong `@cuelingo/ui` (`lib/roadmap.ts`) để web và desktop không lệch. Tab nằm trong địa chỉ: `/review` (Hôm nay), `/review?tab=phrases`, `/review?tab=progress`; tải lại hoặc nút Back giữ nguyên tab. Mỗi tab là một panel của feature tương ứng (`ReviewTodayPanel`, `PhraseBankPanel`, `ProgressPanel`), chọn ngôn ngữ nằm ở tiêu đề chung và truyền xuống panel. Chỉ panel đang mở được dựng, nên phím tắt của phiên ôn không chạy khi ở tab khác.

`/phrases` và `/progress` chuyển hướng vĩnh viễn (301) tới tab tương ứng. Danh sách nằm ở `src/lib/legacy-redirects.ts`, dùng cho `redirects()` của `next.config.ts` (bản máy chủ) và `public/_redirects` (bản tĩnh); test `legacy-redirects.test.ts` giữ hai nơi khớp nhau. Hai trang cũ còn lại như một trang chuyển hướng phía trình duyệt cho máy chủ tĩnh không đọc `_redirects`.
