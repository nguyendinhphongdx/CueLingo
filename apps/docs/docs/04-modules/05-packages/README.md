# Shared packages

> Code: `packages/` · Stack: TypeScript, dùng chung giữa apps và services · Giai đoạn: MVP

Logic và kiểu dữ liệu dùng chung. Mỗi package là một module độc lập, không phụ thuộc vào app nào.

## Modules

| Module                                        | Code                | Trách nhiệm                                                                                                 |
| --------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------- |
| [@cuelingo/shared](./shared.md)               | `shared/src`        | Kiểu domain, schema API/WebSocket (zod), catalog event.                                                     |
| [@cuelingo/core-sdk](./core-sdk.md)           | `core-sdk/src`      | SDK client dùng chung cho desktop và web: auth, REST, stream phiên, hàng đợi event offline.                 |
| [@cuelingo/learner-model](./learner-model.md) | `learner-model/src` | Logic thuần (không I/O) của Learner Model: FSRS hai tầng, giai đoạn từ vựng, chỉ số hiểu, luật Assist Dial. |
| [@cuelingo/ai-gateway](./ai-gateway.md)       | `ai-gateway/src`    | Lớp trừu tượng nhà cung cấp AI: STT, LLM, TTS; routing theo tác vụ; log chi phí và độ trễ; fallback.        |
| [@cuelingo/prompts](./prompts.md)             | `prompts/src`       | Prompt có phiên bản cho từng tác vụ AI, kèm schema đầu ra và fixture test.                                  |
| [@cuelingo/ui](./ui.md)                       | `ui/src`            | Component React dùng chung cho desktop và web.                                                              |

## Quan hệ với phần khác

Xem [sơ đồ hệ thống](../../01-overview/04-system-overview.md).
