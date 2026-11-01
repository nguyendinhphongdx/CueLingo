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

- Đã triển khai:
  - Prompt `debrief.generate@v1` và 3 fixture VI/EN trong `packages/prompts/src/debrief/`; gắn nhãn “Tôi”/“Họ”, giữ khoảng 12.000 ký tự gần nhất, ràng buộc 5 khối, id đoạn khó và câu `mic` được rephrase.
  - Task gateway `debrief.generate`: model mặc định `gemini-3.5-flash-lite`, `AI_DEBRIEF_MODEL`, timeout 60 giây, parse/validate JSON qua gateway hiện có.
  - Job `services/workers/src/jobs/debrief/`: đọc transcript theo thứ tự, bỏ qua session thiếu/rỗng, lọc id lạ, đặt điểm hiểu `null` khi dưới 5 câu, ghi phiên bản `max+1` và cập nhật session trong cùng transaction. Advisory lock bảo vệ số phiên bản khi chạy đồng thời.
  - Worker đăng ký job và nhận `GEMINI_API_KEY` tuỳ chọn; thiếu key không chặn khởi động, job có transcript lỗi rõ ràng để pg-boss retry.
  - Cập nhật trang module `apps/docs/docs/04-modules/04-workers/debrief-job.md`.
- Test đã thêm:
  - `packages/prompts/src/debrief/v1.test.ts`: cấu trúc prompt, nhãn speaker, giới hạn transcript, 3 fixture.
  - `packages/ai-gateway/src/gateway.test.ts`: route/model/timeout/env và output schema.
  - `services/workers/src/jobs/debrief/debrief.test.ts`: AC1–AC4, version mới khi chạy lại, điểm hiểu ít dữ liệu và thiếu key.
  - `services/workers/test/integration/debrief.int.test.ts`: luồng repository thật với Postgres, gồm hai version và trạng thái `debriefed`.
- Kiểm tra:
  - `pnpm verify`: xanh — 36 file test, 162 test; không có vi phạm dependency. Máy chỉ có Node 22.14 (repo yêu cầu ≥22.19) nên lệnh có cảnh báo engine nhưng hoàn tất thành công.
  - `pnpm docs:build`: xanh.
  - Test mục tiêu prompt + gateway + handler: xanh — 20 test.
  - Test Postgres thật chưa chạy được tại worktree này: Testcontainers báo `Could not find a working container runtime strategy` vì Docker daemon không chạy. Test đã typecheck và được để lại cho CI/máy có Docker.
- Khác brief: thêm integration test repository để kiểm tra transaction/version/status; không đổi contract, migration, model mặc định hoặc file ngoài phạm vi được phép.
- Câu hỏi còn mở: không có.
