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
- `describePermission(name, state, os?)`: chuyển trạng thái quyền thành hướng dẫn tiếng Việt, theo hệ điều hành (mặc định là hệ điều hành đang chạy)
- Theo hệ điều hành (`src/lib/platform.ts`, ADR [0020](../../08-adr/0020-windows-capture-stt.md)):

| Chỗ                     | macOS                                                  | Windows                                                                                        |
| ----------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Hai quyền               | Micrô và Âm thanh hệ thống, mở Cài đặt hệ thống        | Chỉ Micrô (mở `ms-settings:privacy-microphone`); âm thanh hệ thống hiện "Không cần cấp quyền." |
| Nút của âm thanh        | Mở Cài đặt hệ thống                                    | Mở cài đặt Âm thanh (`ms-settings:sound`, để chọn thiết bị phát mặc định)                      |
| Phím tắt                | `⌘⇧L/W/S`                                              | `Ctrl+Shift+L/W/S` (một hàm `shortcutLabel`, dùng ở năm chỗ)                                   |
| Banner lỗi thu âm       | `describeCaptureProblems(failures, os?)`: nói về quyền | Cùng hàm, nói về thiết bị phát mặc định và quyền Micro của Windows                             |
| Nhãn thiết bị đăng nhập | `CueLingo cho macOS`                                   | `CueLingo cho Windows`                                                                         |

Thu âm trên Windows chưa có (đợt B của hồ sơ `windows-desktop`): app mở được, bắt đầu họp thì hiện đúng lỗi sidecar trả về, chữ trong app không hứa caption chạy.

- Giai đoạn sau gọi `PATCH /v1/me`, `POST /v1/placement` cho hồ sơ và bài đánh giá

## Phụ thuộc

- TanStack Query
- Cầu nối `apps/desktop/src/lib/native.ts`
- `@cuelingo/core-sdk` (hồ sơ và bài đánh giá, chưa triển khai)

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- Nội dung 3 đoạn nghe: tự thu hay sinh bằng TTS?
