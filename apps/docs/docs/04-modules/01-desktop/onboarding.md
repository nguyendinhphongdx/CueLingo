# Onboarding

> Phần: [Desktop app](./README.md) · Code: `apps/desktop/src/onboarding/`

Đăng nhập, cấp quyền, khai báo mục tiêu và bài nghe đánh giá ban đầu.

## Trách nhiệm

- Đăng nhập Google/email
- Hướng dẫn cấp quyền có hình minh hoạ, kiểm tra mic
- Form nghề, mục tiêu, tần suất họp
- Bài nghe 3 đoạn → `listening_level`, Assist mặc định

## Phạm vi MVP

- US-01, US-02 (F1)

## Interface

- `<PermissionsStep />`: đọc trạng thái bằng TanStack Query, cho phép kiểm tra lại
- `describePermission(name, state)`: chuyển trạng thái quyền thành hướng dẫn tiếng Việt
- Giai đoạn sau gọi `PATCH /v1/me`, `POST /v1/placement` cho hồ sơ và bài đánh giá

## Phụ thuộc

- TanStack Query
- Cầu nối `apps/desktop/src/lib/native.ts`
- `@cuelingo/core-sdk` (hồ sơ và bài đánh giá, chưa triển khai)

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- Nội dung 3 đoạn nghe: tự thu hay sinh bằng TTS?
