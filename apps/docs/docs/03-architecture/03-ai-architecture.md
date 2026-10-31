# Kiến trúc AI

AI được chia hai tầng: **tầng realtime** (dưới 2 giây, model nhỏ và nhanh) và **tầng suy nghĩ** (bất đồng bộ, model mạnh, chạy sau họp hoặc theo lịch). Mọi lời gọi model đều đi qua [`@cuelingo/ai-gateway`](../04-modules/05-packages/ai-gateway.md). Mọi prompt đều nằm trong [`@cuelingo/prompts`](../04-modules/05-packages/prompts.md), có phiên bản.

## Tác vụ AI trong MVP

| Tác vụ               | Tầng     | Model (đề xuất)                                           | Gọi từ                          | Prompt                     |
| -------------------- | -------- | --------------------------------------------------------- | ------------------------------- | -------------------------- |
| STT tiếng Anh        | Realtime | Parakeet-TDT 0.6B v3 on-device; cloud STT dự phòng        | desktop/local-stt, api/realtime | —                          |
| Dịch câu             | Realtime | LLM nhỏ (TranslateGemma 4B / Qwen3-4B hoặc LLM cloud nhỏ) | api/realtime                    | `translate.v1`             |
| Tra từ theo ngữ cảnh | Realtime | LLM nhỏ                                                   | api/assist                      | `lookup.v1`                |
| Recap 60 giây        | Realtime | LLM nhỏ                                                   | api/assist                      | `recap.v1`                 |
| Compose Việt → Anh   | Realtime | LLM nhỏ                                                   | api/assist                      | `compose.v1`               |
| Debrief              | Suy nghĩ | LLM mạnh                                                  | workers/debrief-job             | `debrief.v1` (JSON schema) |
| TTS cho thẻ ôn       | Suy nghĩ | TTS cloud hoặc Kokoro                                     | workers/tts-cache               | —                          |

## Agent ở các giai đoạn sau

| Agent             | Giai đoạn | Việc làm                                        |
| ----------------- | --------- | ----------------------------------------------- |
| Reply Assistant   | Learn     | Gợi ý câu trả lời theo Assist level             |
| Evaluator         | Learn     | Chấm năng lực liên tục, gắn độ khó cho nội dung |
| Speech Coach      | Learn     | Chấm phát âm bằng wav2vec2 phoneme + GOP        |
| Planner           | Coach     | Daily Mix, nhắc rehearsal theo lịch             |
| Content Generator | Coach     | Bài nghe, drill, podcast từ dữ liệu thật        |
| Tutor / Roleplay  | Coach     | Hội thoại voice (Pipecat) với persona thật      |

Các agent không nói chuyện tự do với nhau. Chúng cùng đọc và ghi Learner Model qua API.

## Context Builder

Mỗi lời gọi chỉ ghép phần ngữ cảnh liên quan, không đưa cả lịch sử vào:

- Working context: 3 câu trước (dịch), 60 giây gần nhất (recap), transcript đầy đủ (debrief)
- Glossary của người dùng (lọc theo thuật ngữ xuất hiện trong đoạn)
- Profile: vai trò, mức nghe (để debrief chọn cụm từ vừa sức)

## Chất lượng

- Mỗi prompt có fixture và bộ eval trong [`ml/eval`](../04-modules/06-ml/eval.md). Chạy lại mỗi khi đổi model hoặc prompt.
- Debrief trả JSON theo schema; validate rồi thử lại tối đa 2 lần.
- Luôn hiện câu gốc phía trên bản dịch. Benchmark cho thấy model nào cũng sai một số từ cụ thể.

## Chi phí

`ai-gateway` ghi `cost_usd`, token và độ trễ cho từng lời gọi (event `ai_call`). Báo cáo hằng tuần trong beta để kiểm chứng H5. Cách giảm chi phí: VAD, STT on-device, chỉ dịch luồng `system`, dùng model nhỏ cho realtime, cache TTS.
