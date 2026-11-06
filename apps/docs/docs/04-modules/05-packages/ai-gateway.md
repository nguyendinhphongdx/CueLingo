# @cuelingo/ai-gateway

> Phần: [Shared packages](./README.md) · Code: `packages/ai-gateway/src/`

Lớp trừu tượng nhà cung cấp AI: STT, LLM, TTS; routing theo tác vụ; log chi phí và độ trễ; fallback.

## Trách nhiệm

- Interface `SttProvider`, `LlmProvider`, `TtsProvider`
- Routing theo tác vụ: `translate.realtime`, `assist.*`, `debrief`
- Ghi chi phí, token, độ trễ theo user/phiên
- Timeout + fallback sang nhà cung cấp dự phòng

## Phạm vi MVP

- Toàn bộ

## Interface

- `ai.llm(task, input)`, `ai.stt.stream(opts)`, `ai.tts(text, voice)`, `ai.chat(input, ctx)` (stream một bước, xem Task `agent.chat`)
- `estimateCostUsd(record)` dùng bảng giá theo model; model chưa biết trả `null`.

## Phụ thuộc

- (chưa có)

## Dữ liệu & sự kiện

- Hook `onCall` phát một record cho mỗi lần thử provider (token, model, fallback, kết quả, độ trễ).
- API/worker ghi event nội bộ `ai_call` và cộng chi phí vào phiên liên quan.

## Task `stt.transcribe`

Nhận dạng giọng nói bằng Gemini, âm thanh WAV gửi inline ([ADR 0014](../../08-adr/0014-cloud-stt-for-vietnamese.md), [ADR 0016](../../08-adr/0016-cloud-stt-for-japanese-korean-chinese.md)); prompt `stt/v3` nối `sttHint` của ngôn ngữ trong registry. `gateway.transcribe({ audio, language }, ctx)` trả `{ text, model, fallback, latencyMs }`. Model đặt trong bảng định tuyến (`AI_STT_MODEL`, `AI_STT_FALLBACK_MODEL` ghi đè), hạn 15 giây, lỗi chính thì thử model dự phòng. Ghi `ai_call` không chứa âm thanh hay văn bản; lỗi chỉ mang mã HTTP. Giá âm thanh tính theo token (32 token/giây), cần đối chiếu với bảng giá của nhà cung cấp.

## Task `assist.followup`

Soạn bản nháp follow-up (model theo `AI_ASSIST_MODEL`, hạn 8 giây; không gọi lại cùng một model khi model dự phòng trùng model chính). Dùng `gateway.json` như các task `assist.*`; `ai_call` ghi phiên bản prompt và người dùng, không ghi nội dung debrief hay bản nháp.

`gateway.transcribe` nhận thêm `knownSpeakers?: {label, hint, lastText}[]` (tối đa 8). Có trường này (kể cả mảng rỗng) thì dùng prompt `stt/v4`, Gemini ở chế độ `responseMimeType: application/json`, và kết quả có thêm `speaker: {label: 'speaker_1'…'speaker_8' | 'new' | 'unknown', hint?}`; không có thì dùng `stt/v3` và kết quả không có `speaker`. Parse phòng thủ: JSON hỏng thành `{text: <chữ thô đã làm sạch>, speaker: {label: 'unknown'}}`, nhãn ngoài tập hợp thành `unknown`, hint cắt 60 ký tự và bỏ ký tự điều khiển. `text` vẫn qua bước làm sạch và loại bỏ echo như v3. `hint` và `lastText` không vào `ai_call`, không vào log.

`stt.transcribe` ghi `stt.transcribe@v3`, hoặc `stt.transcribe@v4` khi có `knownSpeakers`. Debrief chọn `v1` hay `v3` theo `learnable` của ngôn ngữ cuộc họp.

## Task `agent.chat`

Một bước stream của trợ lý AI ([ADR 0018](../../08-adr/0018-agent-harness.md)); vòng lặp nhiều bước nằm ở [`@cuelingo/agent`](./agent.md), gateway **không chạy tool**.

```ts
gateway.chat(
  { language, messages: ChatMessage[], tools: ChatToolDeclaration[], signal? },
  ctx?,
): AsyncGenerator<ChatStreamPart, void, void>
```

- `ChatMessage`: `{role:'user', content}` · `{role:'assistant', content, toolCalls?: {id, name, input}[]}` · `{role:'tool', toolCallId, name, content}`. Nội dung tool được bọc trong `<tool_result>...</tool_result>` khi gửi (chuỗi đóng bên trong bị phá), khớp với prompt `agent.chat@v1`: kết quả tool là dữ liệu, không phải chỉ dẫn.
- `ChatToolDeclaration`: `{name, description, inputSchema}` (JSON Schema). Không có `execute`, nên SDK chỉ báo lời gọi rồi dừng sau một bước.
- `ChatStreamPart`: `text_delta {text}` · `tool_call {call: {id, name, input}}` · `finish {reason: stop | tool_calls | length | other, inputTokens?, outputTokens?}` (luôn là phần cuối).
- Model theo `AI_AGENT_MODEL` (mặc định `gemini-3.5-flash-lite`), dự phòng `AI_AGENT_FALLBACK_MODEL` (mặc định `gemini-3.1-flash-lite`), hạn 30 giây mỗi bước, tối đa 2000 token ra, `thinkingLevel: minimal`. Cả hai model đều có trong `MODEL_PRICES` nên `estimateCostUsd` tính được chi phí cho quota.
- Prompt: `agent.chat@v1`; với `createAiGateway({ agentHtmlBlocks: true })` (env `AGENT_HTML_BLOCKS`) dùng `agent.chat@v2` (thêm luật cho `render_html`). Mỗi lần thử ghi một `AiCallRecord` (`task: 'agent.chat'`, `promptVersion` là `agent.chat@v1` hoặc `@v2`, token, `firstTokenMs` = thời gian tới chữ hoặc lời gọi tool đầu tiên). Không ghi nội dung tin nhắn.
- Model dự phòng chỉ được dùng khi model chính lỗi **trước khi** gửi bất cứ thứ gì; đã gửi rồi thì ném `AiGatewayError('agent.chat')`. Bước không có chữ lẫn lời gọi tool tính là lỗi. `signal` bị huỷ thì luồng kết thúc im lặng (không ném), bản ghi `ok: false`.
- Test seam: `createAiGateway({ streamChat })` thay lời gọi `streamText`.

## Câu hỏi mở

- Chọn LLM cloud cho dịch sau khi so với TranslateGemma 4B / Qwen3-4B
