# Settings

> Phần: [Desktop app](./README.md) · Code: `apps/desktop/src/settings/`

Cài đặt trong app và bản đồng bộ theo tài khoản: Assist mặc định cùng cách hiển thị overlay.

## Trách nhiệm

- Tải cài đặt tài khoản sau khi đăng nhập và áp dụng vào native + hai webview
- Chỉnh mức Assist và cách hiển thị overlay
- Đồng bộ thay đổi lên API sau 800 ms không có thao tác mới
- Mở trang quản lý dữ liệu trên web

## Phạm vi MVP

- US-15 (một phần)

## Interface

- `<AssistSettings />`: chọn Assist level `4`, `3`, `1` hoặc `0`
- `useSettings`: store `{assistLevel, setAssistLevel()}` trong bộ nhớ của webview
- Gọi `native.setAssistLevel(level)` và `native.publishSettings({assistLevel})` khi người dùng đổi mức
- `settingsApi`: gọi `GET/PATCH /v1/me/settings` bằng device token
- `useSettingsSync()`: tải và áp dụng cài đặt khi thông tin đăng nhập sẵn sàng
- `queueSettingsPatch()`: deep merge thay đổi và debounce 800 ms; lỗi mạng được giữ để thử cùng lần đổi kế

## Phụ thuộc

- Zustand
- TanStack Query
- Cầu nối `apps/desktop/src/lib/native.ts`
- `@cuelingo/core-sdk` (lưu bền, chưa triển khai)

## Dữ liệu & sự kiện

- Cửa sổ `main` giữ Assist level trong bộ nhớ và phát event `settings` để overlay đổi ngay
- Các khoá `cuelingo.overlay.{fontSize,opacity,theme}` nằm trong `localStorage` chung origin
- Nguồn lưu bền là `UserSettings` ở API; mặc định Assist 4, chữ 18 px, nền 88%, giao diện tối, không lưu audio

## Quyền riêng tư

`saveAudio` mặc định `false`. Web giải thích âm thanh chỉ được giữ đến khi người dùng xoá hoặc tối đa 30 ngày.
