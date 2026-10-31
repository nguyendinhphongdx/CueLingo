# Quick Assist

> Phần: [Desktop app](README.md) · Code: `apps/desktop/src/quick-assist/`

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
