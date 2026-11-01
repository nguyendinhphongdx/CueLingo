# Session controller

> Phần: [Desktop app](./README.md) · Code: `apps/desktop/src/session/`

Máy trạng thái của một cuộc họp phía client: nhận segment từ STT native, kết nối backend và chuyển transcript sang overlay.

## Trách nhiệm

- Trạng thái kết nối `idle | connecting | running | reconnecting | error`
- Gọi `native.sessionStart/Stop`, đăng ký `native.onSegment` và mở WebSocket qua `createRealtimeClient`
- Phát ngay mọi segment sang overlay; chỉ gửi segment final của luồng `system` lên API
- Ghép bản dịch từ API với câu gốc theo `segmentId`, rồi phát lại sang overlay
- Chế độ demo phát 6 segment giả cách nhau 1,5 giây qua cùng đường xử lý segment

## Phạm vi MVP

- F2, F3

## Interface

- `<SessionPanel />`: bắt đầu/dừng phiên, hiện trạng thái kết nối, hiện/ẩn overlay và nút demo trong môi trường dev
- `startSession(assistLevel)`, `stopSession()`, `toggleOverlay()`: action gọi duy nhất qua cầu nối native
- `describeNativeError(error)`: chuyển mã lỗi native thành thông báo tiếng Việt
- `createSessionController({ native, createRealtime, now })`: controller inject dependency để test không cần Tauri/WebSocket
- `useSession()`: snapshot `{status, error}` và action `start()`, `stop()`, `runDemo()`
- `<RecentSessions />`: mở debrief hoặc xoá mềm cuộc họp sau bước xác nhận
- Trang Cài đặt: tải JSON hoặc xoá toàn bộ dữ liệu sau khi gõ `XOA DU LIEU`
- Cấu hình: `VITE_API_URL` (mặc định `ws://localhost:4000`) và `VITE_REALTIME_TOKEN` (mặc định `dev-token`)

## Phụ thuộc

- Cầu nối `apps/desktop/src/lib/native.ts`
- `@cuelingo/core-sdk`, `@cuelingo/shared`

## Dữ liệu & sự kiện

- Native vào: `segment`
- Native ra: `transcript`
- WebSocket ra: `hello`, `segment.final`
- WebSocket vào: `ready`, `translation`, `error`

## Câu hỏi mở

- (chưa có)
