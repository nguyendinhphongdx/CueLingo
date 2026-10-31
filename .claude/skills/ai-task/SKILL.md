---
name: ai-task
description: Thêm hoặc sửa một tác vụ AI (dịch realtime, tra từ, recap, compose, debrief, chấm điểm…) — prompt có phiên bản trong @cuelingo/prompts, task trong @cuelingo/ai-gateway, eval trong ml/eval. Dùng mỗi khi đổi prompt, model hoặc thêm lời gọi AI mới.
---

# ai-task — Prompt + gateway + eval

Convention: [ai-calls](../../../docs/05-engineering/conventions/ai-calls.md). Kiến trúc: [ai-architecture](../../../docs/02-architecture/ai-architecture.md).

## Thêm tác vụ mới

1. **Tên tác vụ** theo dạng `<nhóm>.<việc>` (`translate.realtime`, `assist.lookup`). Ghi vào bảng tác vụ trong `docs/02-architecture/ai-architecture.md`.
2. **Prompt** `packages/prompts/src/<task>/v1.ts`:
   - `build(input) → messages`; input có Zod schema.
   - Đầu ra có cấu trúc → Zod schema cho output.
   - 3–5 fixture (input + đầu ra mong đợi hoặc tiêu chí).
3. **Gateway** `packages/ai-gateway`: đăng ký task → model mặc định, timeout, fallback. Ghi `ai_call` (task, model, token, chi phí, độ trễ, prompt version).
4. **Eval** `ml/eval`: thêm task với fixture; chỉ số phù hợp (COMET cho dịch, LLM-as-judge + mẫu cho người đọc cho debrief).
5. **Gọi** từ service/worker: `ai.llm('<task>', input)`. Không import SDK nhà cung cấp (ESLint chặn).

## Sửa prompt hoặc đổi model

1. **Không sửa** `v<n>` đang dùng. Tạo `v<n+1>`.
2. Chạy eval cho cả hai phiên bản, ghi bảng so sánh (chất lượng, độ trễ p50/p95, chi phí) vào `03-review.md`.
3. Chỉ chuyển mặc định sang phiên bản mới khi eval không tệ hơn.

## Anti-pattern

- ❌ Prompt viết inline trong service.
- ❌ Chọn model ở chỗ gọi thay vì trong gateway.
- ❌ Đổi prompt không có số liệu eval.
- ❌ Gửi transcript tới nhà cung cấp chưa có trong danh sách được duyệt ([privacy-security](../../../docs/05-engineering/conventions/privacy-security.md)).
