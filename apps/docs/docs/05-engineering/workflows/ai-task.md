---
title: ai-task
---

# Workflow · ai-task — Prompt + gateway + eval

Dùng khi thêm lời gọi AI mới, đổi prompt hoặc đổi model. Quy ước: [ai-calls](../conventions/ai-calls.md). Kiến trúc: [Kiến trúc AI](../../03-architecture/06-ai-architecture.md).

## Thêm tác vụ mới

1. **Tên** `<nhóm>.<việc>` (`translate.realtime`, `assist.lookup`); thêm vào bảng tác vụ trong Kiến trúc AI.
2. **Prompt** `packages/prompts/src/<task>/v1.ts`: `build(input) → messages`; input và output có Zod schema; 3–5 fixture trong `<task>/fixtures/`.
3. **Gateway** `packages/ai-gateway/src/tasks.ts`: task → model mặc định, timeout, fallback; mọi lời gọi ghi `ai_call` (task, model, token, chi phí, độ trễ, prompt version). Gọi model bằng Vercel AI SDK **chỉ trong gateway** ([ADR-0010](../../08-adr/0010-ai-gateway-on-ai-sdk.md)).
4. **Eval** `ml/eval`: thêm task, chạy `uv run cuelingo-eval --task <task> --prompt v1` ([ML scaffold](../scaffold/08-ml-python.md)).
5. **Gọi** từ service/worker: `ai.llm('<task>', input)`.

## Sửa prompt hoặc đổi model

1. **Không sửa** `v<n>` đang dùng; tạo `v<n+1>`.
2. Chạy eval cho cả hai; bảng so sánh (chất lượng, p50/p95, chi phí) vào `03-review.md`.
3. Chỉ chuyển mặc định khi eval không tệ hơn.

## Anti-pattern

- ❌ Prompt inline trong service · chọn model ở chỗ gọi.
- ❌ Đổi prompt/model không có số liệu eval.
- ❌ Gửi transcript tới nhà cung cấp chưa được duyệt ([privacy-security](../conventions/privacy-security.md)).
