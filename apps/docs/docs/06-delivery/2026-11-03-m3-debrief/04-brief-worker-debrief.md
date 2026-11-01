---
title: Brief M3-03 · workers/debrief-job
---

# Brief — M3-03 · Debrief job

> Nhánh `feat/m3-debrief-codex` · Worktree `.worktrees/m3-debrief-codex`

## Mục tiêu

Job `debrief.generate` (`{sessionId}`) đọc transcript một session (bảng `segments`, theo `start_ms`, ghi nhãn mic = "Tôi", system = "Họ"), gọi AI sinh `DebriefContent` (`packages/shared/src/dto/debrief.dto.ts`) rồi ghi một dòng mới vào bảng `debriefs` (`version` = max+1, `prompt_version`), đặt `sessions.status = 'debriefed'`.

- Prompt `debrief.generate@v1` trong `packages/prompts/src/debrief/` (copy `translate/` và `assist/`): tiếng Việt, ngắn gọn, đúng 5 khối; `hardSegmentIds` chỉ chọn id có trong đầu vào; "câu bạn nói → câu nên nói" chỉ lấy từ câu **mic**; transcript dài thì cắt còn tối đa ~12 000 ký tự gần nhất.
- Task `debrief.generate` trong `packages/ai-gateway/src/tasks.ts` (timeout 60 s, model `AI_DEBRIEF_MODEL` mặc định `gemini-3.5-flash-lite`), gọi qua `gateway.json()` đã có (xem `assist`).
- Handler trong `services/workers/src/jobs/debrief/` theo mẫu `retention`; worker cần `GEMINI_API_KEY` tuỳ chọn trong config (thiếu → job lỗi rõ ràng, không crash tiến trình). Idempotent: chạy lại tạo version mới, không hỏng dữ liệu cũ. Session không tồn tại hoặc không có segment → bỏ qua và log.
- Loại bỏ id lạ khỏi `hardSegmentIds`; `comprehensionPct` = null nếu < 5 câu.
- Doc: `04-modules/04-workers/debrief-job.md`.

## AC

| #   | AC (EARS)                                                                                                       | Test                                   |
| --- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| AC1 | WHEN job chạy cho session có segments THE SYSTEM SHALL ghi debrief hợp lệ với schema và đặt session `debriefed` | `debrief.test.ts` (repo + gateway giả) |
| AC2 | IF AI trả JSON hỏng THEN job thất bại có retry theo pg-boss, không ghi debrief rác                              | `debrief.test.ts`                      |
| AC3 | IF session không có segment THEN không gọi AI, không ghi debrief                                                | `debrief.test.ts`                      |
| AC4 | `hardSegmentIds` không chứa id ngoài transcript                                                                 | `debrief.test.ts`                      |
| AC5 | Prompt có test cấu trúc + vài fixture hội thoại (3 cuộc họp ngắn VI/EN)                                         | prompts test                           |

## Phạm vi file

Được sửa/tạo: `packages/prompts/**`, `packages/ai-gateway/**`, `services/workers/**`, doc module. Không sửa `services/api/**`, `apps/**`, `infra/**`, `packages/shared/**`.

Quy tắc chung: đọc `AGENTS.md` gốc và `AGENTS.md` của thư mục bạn sửa, `apps/docs/docs/05-engineering/agent-collaboration.md`. Không có mạng, không `pnpm add`, không commit/push; dependency đã cài sẵn. Không đổi hợp đồng trong `packages/shared/src/dto/{session,debrief,phrase}.dto.ts` (nếu thật sự thiếu, dừng và ghi câu hỏi). Chạy `pnpm verify` trước khi báo; điền mục Kết quả.

## Kết quả _(implementer điền)_
