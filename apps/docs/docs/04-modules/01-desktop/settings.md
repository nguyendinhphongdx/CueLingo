# Settings

> Phần: [Desktop app](./README.md) · Code: `apps/desktop/src/settings/`

Cài đặt trong app: phím tắt, Assist mặc định, lưu audio, nguồn STT.

## Trách nhiệm

- Chỉnh phím tắt, cỡ chữ, vị trí overlay
- Bật/tắt lưu audio, thời hạn lưu
- Chọn STT local/cloud
- Mở trang quản lý dữ liệu trên web

## Phạm vi MVP

- US-15 (một phần)

## Interface

- `<AssistSettings />`: chọn Assist level `4`, `3`, `1` hoặc `0`
- `useSettings`: store `{assistLevel, setAssistLevel()}` trong bộ nhớ của webview
- Gọi `native.setAssistLevel(level)` và `native.publishSettings({assistLevel})` khi người dùng đổi mức
- Giai đoạn sau dùng `GET/PATCH /v1/me/settings` để lưu bền

## Phụ thuộc

- Zustand
- TanStack Query
- Cầu nối `apps/desktop/src/lib/native.ts`
- `@cuelingo/core-sdk` (lưu bền, chưa triển khai)

## Dữ liệu & sự kiện

- Cửa sổ `main` giữ Assist level trong bộ nhớ và phát event `settings` để overlay đổi ngay

## Câu hỏi mở

- Lưu cài đặt bền ở local hay đồng bộ qua API?
