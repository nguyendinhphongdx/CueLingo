# Convention · Gọi AI (`@cuelingo/ai-gateway`, `@cuelingo/prompts`)

Chưa có module mẫu chạy thật. Module đầu tiên làm theo convention này (dự kiến `translate.realtime`) sẽ thành mẫu.

| #   | Luật                                                                                                                                                                                        | Máy kiểm?   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | Mọi lời gọi STT / LLM / TTS đi qua `@cuelingo/ai-gateway`. Không import SDK nhà cung cấp ở nơi khác                                                                                         | Có (ESLint) |
| 2   | Mỗi tác vụ có tên (`translate.realtime`, `assist.lookup`, `assist.recap`, `assist.compose`, `assist.followup`, `debrief`) và được route tới model trong gateway, không chọn model ở chỗ gọi | Không       |
| 3   | Prompt nằm ở `packages/prompts/src/<task>/v<n>.ts`, có phiên bản. **Không sửa phiên bản đã dùng ở production**; tạo `v<n+1>`                                                                | Không       |
| 4   | Đầu ra có cấu trúc (debrief, lookup) có Zod schema; validate, thử lại tối đa 2 lần                                                                                                          | Không       |
| 5   | Gateway ghi `ai_call` event: task, model, token, `cost_usd`, `latency_ms`, prompt version                                                                                                   | Không       |
| 6   | Đổi model hoặc prompt → chạy `ml/eval` cho task đó và ghi kết quả vào PR                                                                                                                    | Không       |
| 7   | Không gửi dữ liệu người dùng tới nhà cung cấp chưa được duyệt trong [privacy-security](./privacy-security.md)                                                                               | Không       |

## Thêm tác vụ AI

1. Prompt `packages/prompts/src/<task>/v1.ts`: `build(input) → messages`, schema đầu ra, 3–5 fixture.
2. Task trong gateway: tên, model mặc định, timeout, fallback.
3. Fixture/eval trong `ml/eval` (xem [03-parts/ml/eval](../../04-modules/06-ml/eval.md)).
4. Gọi từ service qua `ai.llm('<task>', input)`.
