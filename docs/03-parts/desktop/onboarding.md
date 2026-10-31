# Onboarding

> Phần: [Desktop app](README.md) · Code: `apps/desktop/src/onboarding/`

Đăng nhập, cấp quyền, khai báo mục tiêu và bài nghe đánh giá ban đầu.

## Trách nhiệm

- Đăng nhập Google/email
- Hướng dẫn cấp quyền có hình minh hoạ, kiểm tra mic
- Form nghề, mục tiêu, tần suất họp
- Bài nghe 3 đoạn → `listening_level`, Assist mặc định

## Phạm vi MVP

- US-01, US-02 (F1)

## Interface

- Gọi `PATCH /v1/me`, `POST /v1/placement`

## Phụ thuộc

- `@cuelingo/core-sdk`

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- Nội dung 3 đoạn nghe: tự thu hay sinh bằng TTS?
