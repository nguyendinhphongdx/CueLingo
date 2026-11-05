# Retention cleanup

> Phần: [Workers](./README.md) · Code: `services/workers/src/jobs/retention/`

Xoá audio quá hạn, phiên và hội thoại trợ lý đã xoá hết thời gian khôi phục, và dọn tin nhắn trợ lý bị kẹt. **Job mẫu** của `services/workers`: copy cấu trúc này cho job mới ([scaffold worker](../../05-engineering/scaffold/03-worker.md)).

## Trách nhiệm

- `retention.sweep` chạy 03:15 UTC mỗi ngày: tìm segment có `audio_key` thuộc cuộc họp bắt đầu hơn **30 ngày** trước, xoá object trong storage, rồi đặt `audio_key = NULL`.
- Xử lý theo lô 500 cho tới khi hết; chạy lại không đổi kết quả (xoá object là idempotent; lỗi storage giữ nguyên key để lần sau thử lại).
- Xoá cứng phiên có `status = 'deleted'` và thời điểm xoá trong `ended_at` quá 7 ngày; khoá ngoại cascade dọn segments, events và debriefs.
- Xoá cứng hội thoại trợ lý AI (`agent_conversations`) có `deleted_at` quá 7 ngày; `agent_messages` cascade.
- Đổi tin `agent_messages` còn `status = 'streaming'` quá 10 phút (tiến trình đã chết) sang `error`.
- Chạy lại không thay đổi kết quả.

## Phạm vi MVP

- US-15 (kiểm soát dữ liệu). Mặc định không lưu audio ([ADR-0006](../../08-adr/0006-no-audio-by-default.md)), nên job chủ yếu là lưới an toàn.

## Interface

- Job `retention.sweep`, payload `{}` (`@cuelingo/shared/jobs`).
- `sweepExpiredAudio(deps)` — hàm thuần, test bằng repository/storage giả.
- `sweepExpiredAudio(deps)`, `sweepDeletedSessions(deps)`, `sweepDeletedConversations(deps)` và `sweepStaleStreamingMessages(deps)` (trả `{removed}` / `{marked}`).
- `RetentionRepository` (`findExpiredAudio`, `clearAudioKeys`, `deleteExpiredSessions`, `deleteExpiredConversations`, `failStaleStreamingMessages`), `ObjectStorage.deleteMany` (storage chưa chọn: `createUnconfiguredStorage()` từ chối nếu có key cần xoá).

## Phụ thuộc

- `@cuelingo/shared` (tên job, payload); Postgres (`segments`, `sessions`, `agent_conversations`, `agent_messages`).

## Dữ liệu & sự kiện

- Đọc `segments.audio_key`, `sessions.started_at`, `sessions.status`; ghi `segments.audio_key`; xoá `sessions` quá hạn; đọc `agent_conversations.deleted_at` và xoá cứng quá hạn; ghi `agent_messages.status`.

## Câu hỏi mở

- Nhà cung cấp object storage (S3-compatible) và cách ghi/xoá object.
- Integration test cho `createPostgresRetentionRepository` có ở `services/workers/test/integration/retention.int.test.ts` (cần Docker).
