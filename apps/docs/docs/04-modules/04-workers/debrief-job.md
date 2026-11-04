# Debrief job

> Phần: [Workers](./README.md) · Code: `services/workers/src/jobs/debrief/`

Phân tích cuộc họp sau khi kết thúc, tạo debrief JSON.

## Trách nhiệm

- Đọc transcript theo `start_ms`, nối `speakers` qua `segments.speaker_id` để lấy `label` và `display_name`. Dòng transcript `[id] <nhãn>:` với nhãn là “Tôi” (`me`), tên người dùng đặt, “Speaker N” (chưa có tên) hoặc “Người khác”; câu cũ không có `speaker_id` theo `source` (`mic` → “Tôi”, `system` → “Người khác”). Tên đi qua `cleanText` và nằm trong khối `<transcript>`; `owner` dùng tên đã đặt, không bịa tên; hai nhãn cùng tên là một người.
- Cắt transcript dài còn tối đa khoảng 12.000 ký tự gần nhất.
- Gọi `debrief.generate` qua `@cuelingo/ai-gateway`; validate `DebriefContentSchema` và thử lại một lần khi JSON sai.
- Loại `hardSegmentIds` không thuộc transcript; đặt `comprehensionPct = null` khi có dưới 5 câu.
- Ghi phiên bản debrief mới và đổi trạng thái session thành `debriefed` trong cùng transaction.

## Phạm vi MVP

- F4 — debrief gồm 5 khối: tóm tắt, quyết định/việc cần làm, đoạn khó, cụm từ và câu nên nói.
- Chạy lại tạo `version = max+1`; dữ liệu phiên bản cũ không đổi.
- Session không tồn tại hoặc không có segment được bỏ qua mà không gọi AI.

## Interface

- Job `debrief.generate {sessionId}` (`@cuelingo/shared`).
- Prompt `debrief.generate@v4` (ngôn ngữ học được) hoặc `@v5` (không học được), chọn bởi `debriefPromptVersionFor(language)` (`packages/prompts/src/debrief/`). v1–v3 giữ nguyên, không còn được chọn.
- Model mặc định `gemini-3.5-flash-lite`, timeout 60 giây; ghi đè bằng `AI_DEBRIEF_MODEL`.
- Worker có thể khởi động khi thiếu `GEMINI_API_KEY`; job có transcript sẽ thất bại rõ ràng để pg-boss retry.

## Phụ thuộc

- `@cuelingo/shared` (`DebriefContentSchema`, payload job).
- `@cuelingo/prompts`, `@cuelingo/ai-gateway`.
- Postgres (`sessions`, `segments`, `speakers`, `debriefs`).

## Dữ liệu & sự kiện

- Đọc `sessions`, `segments`, `speakers` theo `session_id`. Đổi tên người nói không tạo lại debrief; người dùng bấm tạo lại.
- Thêm một dòng `debriefs` với `prompt_version`; cập nhật `sessions.status = 'debriefed'`.
- Không log transcript, tên người nói hoặc nội dung debrief; log chỉ có `sessionId` và metadata lời gọi AI.

## Câu hỏi mở

- Có cần chạy lại diarization offline (pyannote) cho debrief không? Cần Python worker.
- `comprehensionPct` sẽ dùng thêm tín hiệu event nào khi Learner Model được nối?
