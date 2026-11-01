# Retention cleanup

> Phần: [Workers](./README.md) · Code: `services/workers/src/jobs/retention/`

Xoá audio quá hạn và phiên đã xoá hết thời gian khôi phục. **Job mẫu** của `services/workers`: copy cấu trúc này cho job mới ([scaffold worker](../../05-engineering/scaffold/03-worker.md)).

## Trách nhiệm

- `retention.sweep` chạy 03:15 UTC mỗi ngày: tìm segment có `audio_key` thuộc cuộc họp bắt đầu hơn **30 ngày** trước, xoá object trong storage, rồi đặt `audio_key = NULL`.
- Xử lý theo lô 500 cho tới khi hết; chạy lại không đổi kết quả (xoá object là idempotent; lỗi storage giữ nguyên key để lần sau thử lại).
- Xoá cứng phiên có `status = 'deleted'` và thời điểm xoá trong `ended_at` quá 7 ngày; khoá ngoại cascade dọn segments, events và debriefs.
- Chạy lại không thay đổi kết quả.

## Phạm vi MVP

- US-15 (kiểm soát dữ liệu). Mặc định không lưu audio ([ADR-0006](../../08-adr/0006-no-audio-by-default.md)), nên job chủ yếu là lưới an toàn.

## Interface

- Job `retention.sweep`, payload `{}` (`@cuelingo/shared/jobs`).
- `sweepExpiredAudio(deps)` — hàm thuần, test bằng repository/storage giả.
- `sweepExpiredAudio(deps)` và `sweepDeletedSessions(deps)`.
- `RetentionRepository` (`findExpiredAudio`, `clearAudioKeys`, `deleteExpiredSessions`), `ObjectStorage.deleteMany` (storage chưa chọn: `createUnconfiguredStorage()` từ chối nếu có key cần xoá).

## Phụ thuộc

- `@cuelingo/shared` (tên job, payload); Postgres (`segments`, `sessions`).

## Dữ liệu & sự kiện

- Đọc `segments.audio_key`, `sessions.started_at`, `sessions.status`; ghi `segments.audio_key`; xoá `sessions` quá hạn.

## Câu hỏi mở

- Nhà cung cấp object storage (S3-compatible) và cách ghi/xoá object.
- Cần integration test cho `createPostgresRetentionRepository` với Postgres thật (chưa có).
