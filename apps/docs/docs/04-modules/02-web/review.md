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

## Bốn tab: Hôm nay, Kho cụm từ, Tiến độ, Lộ trình

Ôn tập là một mục với bốn tab, danh sách tab lấy từ `REVIEW_TABS` trong `@cuelingo/ui` (`lib/roadmap.ts`) để web và desktop không lệch. Tab nằm trong địa chỉ: `/review` (Hôm nay), `/review?tab=phrases`, `/review?tab=progress`, `/review?tab=path`; tải lại hoặc nút Back giữ nguyên tab. Mỗi tab là một panel của feature tương ứng (`ReviewTodayPanel`, `PhraseBankPanel`, `ProgressPanel`, `LearningPathTab`), chọn ngôn ngữ nằm ở tiêu đề chung và truyền xuống panel. Chỉ panel đang mở được dựng, nên phím tắt của phiên ôn không chạy khi ở tab khác.

`/phrases` và `/progress` chuyển hướng vĩnh viễn (301) tới tab tương ứng. Danh sách nằm ở `src/lib/legacy-redirects.ts`, dùng cho `redirects()` của `next.config.ts` (bản máy chủ) và `public/_redirects` (bản tĩnh); test `legacy-redirects.test.ts` giữ hai nơi khớp nhau. Hai trang cũ còn lại như một trang chuyển hướng phía trình duyệt cho máy chủ tĩnh không đọc `_redirects`.

## Tab Lộ trình

Code: `apps/web/src/features/learning-path/`. Tab vẽ `LearningPathPanel` (`@cuelingo/ui`, dùng chung với desktop) từ `client.courses` ([courses](../03-api/courses.md)). "Bắt đầu khoá" thêm các cụm của khoá vào Kho cụm từ (nút nói rõ số cụm) rồi mở một lần học; "Học tiếp" mở thẳng. Một lần học chạy bằng chính `ReviewTodayPanel` của tab Hôm nay, chỉ đổi nguồn hàng đợi: `useReview(language, source)` nhận `source?: {key, load}`, bỏ trống thì vẫn là `/v1/review/queue`. Câu trả lời vẫn đi `POST /v1/review/answer`, nên FSRS và tiến độ khoá cùng một nguồn. Lỗi API khoá chỉ hiện thông báo tiếng Việt ở tab này; ba tab kia không bị ảnh hưởng. Trang [debrief](./debrief.md) có link "Học khoá này" tới `/review?tab=path`.

## Mục tiêu trong tab Lộ trình

Tab Lộ trình có thêm phần **Mục tiêu của bạn** (chỉ khi ngôn ngữ học là tiếng Anh): chọn tối đa 3 mục tiêu, mở từng bài (`features/goals/GoalLessonPage.tsx`), sửa hoặc xoá mục tiêu. Khi danh sách mục tiêu lỗi, các khoá từ cuộc họp vẫn hiện. Xem [goals](../03-api/goals.md).
