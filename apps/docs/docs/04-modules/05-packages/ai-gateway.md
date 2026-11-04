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

- `ai.llm(task, input)`, `ai.stt.stream(opts)`, `ai.tts(text, voice)`
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

## Câu hỏi mở

- Chọn LLM cloud cho dịch sau khi so với TranslateGemma 4B / Qwen3-4B
