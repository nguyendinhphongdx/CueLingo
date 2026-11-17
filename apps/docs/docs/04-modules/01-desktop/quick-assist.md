# Quick Assist

> Phần: [Desktop app](./README.md) · Code: `apps/desktop/src/quick-assist/`

Tra từ theo ngữ cảnh, "Họ vừa nói gì?", "Nói giúp tôi" + teleprompter.

## Trách nhiệm

- Popup tra từ/cụm: nghĩa theo câu, phiên âm, phát âm, Lưu vào Phrase Bank
- Recap 60 giây gần nhất bằng tiếng Việt
- Ô nhập tiếng Việt → 2 phiên bản tiếng Anh, chế độ chữ lớn

## Phạm vi MVP

- US-06, US-07, US-08 (F3)

## Interface

- Gọi `POST /v1/assist/lookup|recap|compose` qua `core-sdk`

## Phụ thuộc

- `@cuelingo/core-sdk`, `@cuelingo/ui`

## Dữ liệu & sự kiện

- Events: `lookup`, `ask_recap`, `compose_assist`, `phrase_saved`

## Câu hỏi mở

- (chưa có)

## Họp tiếng Việt

Mỗi câu "Nói giúp" soạn ra là một hàng `SpeakableOption` (`@cuelingo/ui`): câu tiếng Anh, ghi chú tiếng Việt, nút **Nghe thử** (vòng quay khi đang tải, ô vuông để dừng) và **Sao chép** (hiện "Đã sao chép" 2 giây). Không còn bước chọn trước khi sao chép; sao chép thì ghi sự kiện `compose_used`. Tiếng đọc ra loa của máy, không vào cuộc họp.

Tra từ và "Nói giúp" chỉ có với ngôn ngữ `learnable`. Trong họp tiếng Việt, caption không có nút "Tra từ", và nếu bảng mở ở chế độ tra từ hay "Nói giúp" thì hiện "Tính năng này chưa hỗ trợ họp bằng tiếng việt"; "Họ vừa nói gì?" vẫn dùng được. DTO assist cũng từ chối `vi` ở lookup và compose (400), recap nhận mọi ngôn ngữ đã bật.

## Ngăn kéo và chữ lớn

Ngăn kéo bên phải caption (bề rộng `DRAWER_WIDTH`, do cơ chế cửa sổ overlay quyết định): Esc đóng ngăn kéo, ô "Nói giúp" tự lấy tiêu điểm khi mở. Ở đầu ngăn kéo Nói giúp có dòng **Họ vừa hỏi: “…”** là câu cuối của người khác (luồng `system`, đã chốt) lấy từ `transcript-store` của overlay; `CaptionOverlay` truyền qua prop `asked`, chỉ nằm trong bộ nhớ, không lưu, không log; chưa có câu thì không hiện dòng. Dưới mỗi `SpeakableOption` có nút **Hiện chữ lớn**.

Màn **Nói giúp: chữ lớn** (`Teleprompter`) phủ toàn overlay bằng nền đặc `bg-background`: câu tiếng Anh cỡ lớn, ghi chú tiếng Việt màu `translation`, nút **Nghe** (đọc bằng loa máy, bấm lại để dừng), **Sao chép** (ghi `compose_used` như ở ngăn kéo) và ba cỡ chữ (`aria-pressed`). Esc hoặc **Quay lại các lựa chọn** trở về danh sách.
