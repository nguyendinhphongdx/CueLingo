# Assist

> Phần: [API service](README.md) · Code: `services/api/src/modules/assist/`

Tra từ theo ngữ cảnh, recap, compose (Việt → Anh).

## Trách nhiệm

- `lookup`: nghĩa theo câu chứa từ
- `recap`: tóm tắt N giây gần nhất
- `compose`: 2 phiên bản lịch sự / ngắn gọn

## Phạm vi MVP

- F3

## Interface

- `POST /v1/assist/lookup|recap|compose`

## Phụ thuộc

- `@cuelingo/ai-gateway`, `@cuelingo/prompts`

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- (chưa có)
