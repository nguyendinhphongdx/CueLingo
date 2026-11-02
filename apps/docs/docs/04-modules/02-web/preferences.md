# Preferences

> Phần: [Web app](./README.md) · Code: `apps/web/src/features/preferences/`

Mục “Tuỳ chọn” trong `/settings`, dùng để chỉnh cài đặt chung của tài khoản.

## Interface

- Assist mặc định: `4`, `3`, `1`, `0`
- Overlay: cỡ chữ 14–28 px, độ đậm nền 55–100%, giao diện tối/sáng
- Lưu audio: công tắc mặc định tắt; mô tả nơi lưu và hạn tối đa 30 ngày
- Nút lưu có trạng thái đang lưu, thành công và lỗi tiếng Việt

## Phụ thuộc

- `@cuelingo/shared` (`UserSettings`)
- TanStack Query
- API client duy nhất ở `src/lib/client.ts`
