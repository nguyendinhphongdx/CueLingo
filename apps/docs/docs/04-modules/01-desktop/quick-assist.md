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

Tra từ và "Nói giúp" chỉ có với ngôn ngữ `learnable`. Trong họp tiếng Việt, caption không có nút "Tra từ", và nếu bảng mở ở chế độ tra từ hay "Nói giúp" thì hiện "Tính năng này chưa hỗ trợ họp bằng tiếng việt"; "Họ vừa nói gì?" vẫn dùng được. DTO assist cũng từ chối `vi` ở lookup và compose (400), recap nhận mọi ngôn ngữ đã bật.
