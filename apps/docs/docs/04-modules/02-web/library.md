# Meeting library

> Phần: [Web app](./README.md) · Code: `apps/web/src/features/library/`

Danh sách cuộc họp, tìm kiếm, lọc theo người và ngày.

## Trách nhiệm

- Liệt kê phiên, trạng thái debrief
- Tìm kiếm toàn văn và ngữ nghĩa trong transcript
- Transcript song ngữ có thể nhảy theo thời gian

## Phạm vi MVP

- S7

## Interface

- `GET /v1/sessions`, `GET /v1/sessions/:id`

## Phụ thuộc

- `@cuelingo/core-sdk`

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- (chưa có)

## Tìm trong cuộc họp (UI redesign, AC10)

Ô tìm tìm trong tiêu đề và lời thoại (tiếng Anh và bản dịch), đoạn khớp hiện dưới tiêu đề kèm tên người nói và chữ khớp được đánh dấu `<mark>`. Có hai bộ lọc: **tháng** (theo giờ Việt Nam, lấy từ các cuộc họp đang có) và **người nói** (tên hiển thị, lấy từ các cuộc họp đã đọc).

API chưa có endpoint tìm kiếm, nên tìm chạy ở trình duyệt: khi có từ khoá từ 2 ký tự (hoặc chọn người nói), trang đọc `GET /v1/sessions/:id` của **30 cuộc họp gần nhất** (cùng khoá cache `['sessions', id]` với trang debrief) rồi lọc bằng các hàm thuần trong `@cuelingo/ui/lib/meeting-search` (dùng chung với desktop; `HighlightedText` và `useDebounced` cũng ở `@cuelingo/ui`). Việc đọc chỉ bắt đầu khi người dùng ngừng gõ 300 ms (`useDebounced`), và `details` giữ nguyên giữa các lần render khi dữ liệu không đổi. Cuộc họp cũ hơn chỉ khớp theo tiêu đề và trang nói rõ điều đó. Tìm toàn văn phía máy chủ vẫn là việc sau.
