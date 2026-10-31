# @cuelingo/ai-gateway

> Phần: [Shared packages](README.md) · Code: `packages/ai-gateway/src/`

Lớp trừu tượng nhà cung cấp AI: STT, LLM, TTS; routing theo tác vụ; log chi phí và độ trễ; fallback.

## Trách nhiệm

- Interface `SttProvider`, `LlmProvider`, `TtsProvider`
- Routing theo tác vụ: `translate.realtime`, `assist.*`, `debrief`
- Ghi chi phí, token, độ trễ theo user/phiên
- Timeout + fallback sang nhà cung cấp dự phòng

## Phạm vi MVP

- Toàn bộ

## Interface

- `ai.llm(task, input)`, `ai.stt.stream(opts)`, `ai.tts(text, voice)`

## Phụ thuộc

- (chưa có)

## Dữ liệu & sự kiện

- Event nội bộ `ai_call` (cost, latency)

## Câu hỏi mở

- Chọn LLM cloud cho dịch sau khi so với TranslateGemma 4B / Qwen3-4B
