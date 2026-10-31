# Session controller

> Phần: [Desktop app](README.md) · Code: `apps/desktop/src/session/`

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

- Store (Zustand) `useSession()`: `{status, segments, assistLevel, start(), stop()}`

## Phụ thuộc

- `@cuelingo/core-sdk`, `@cuelingo/shared`

## Dữ liệu & sự kiện

- Events: `session_started`, `session_ended`, `segment_final`, `assist_level_changed`

## Câu hỏi mở

- (chưa có)
