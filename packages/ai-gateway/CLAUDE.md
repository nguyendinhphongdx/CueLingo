# CLAUDE.md — packages/ai-gateway

Nơi duy nhất được import SDK nhà cung cấp AI. Convention: [ai-calls](../../apps/docs/docs/05-engineering/conventions/ai-calls.md).

- Gọi theo tên tác vụ (`translate.realtime`, `assist.*`, `debrief`), không theo tên model.
- Mỗi lời gọi ghi task, model, token, chi phí, độ trễ, prompt version.
- Timeout + fallback cho tác vụ realtime. Nhà cung cấp mới nhận dữ liệu người dùng → ADR.
