# Session controller

> Phần: [Desktop app](./README.md) · Code: `apps/desktop/src/session/`

Máy trạng thái của một cuộc họp phía client: kết nối backend, giữ danh sách câu, áp dụng Assist level.

## Trách nhiệm

- Trạng thái `idle → starting → live → ending → debriefing`
- Mở phiên qua `core-sdk`, gửi transcript final (STT local) hoặc audio (STT cloud)
- Ghép transcript và bản dịch theo `segmentId`, giữ 200 câu gần nhất trong bộ nhớ
- Ghi tín hiệu học tập (`lookup`, `translation_expanded`, `ask_recap`…) qua `core-sdk`
- Tự kết thúc sau 5 phút im lặng

## Phạm vi MVP

- F2, F3

## Interface

- `<SessionPanel />`: bắt đầu/dừng phiên và hiện/ẩn overlay
- `startSession(assistLevel)`, `stopSession()`, `toggleOverlay()`: action gọi duy nhất qua cầu nối native
- `describeNativeError(error)`: chuyển mã lỗi native thành thông báo tiếng Việt
- Store `useSession()` với `{status, segments, assistLevel, start(), stop()}` thuộc giai đoạn realtime, chưa triển khai

## Phụ thuộc

- TanStack Query
- Cầu nối `apps/desktop/src/lib/native.ts`
- `@cuelingo/core-sdk`, `@cuelingo/shared` (giai đoạn realtime)

## Dữ liệu & sự kiện

- Events: `session_started`, `session_ended`, `segment_final`, `assist_level_changed`

## Câu hỏi mở

- (chưa có)
