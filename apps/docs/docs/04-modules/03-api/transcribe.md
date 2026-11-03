# Transcribe

> Phần: [API service](./README.md) · Code: `services/api/src/modules/transcribe/` · Quyết định: [ADR 0014](../../08-adr/0014-cloud-stt-for-vietnamese.md)

Nhận dạng giọng nói bằng đám mây cho ngôn ngữ chưa có model trên máy (hiện là tiếng Việt). Client gửi âm thanh **một câu**, API trả văn bản.

## Trách nhiệm

- Chỉ nhận âm thanh cho phiên của chính người dùng (`userId` từ auth; phiên của người khác hoặc không có là 404)
- Chỉ cho ngôn ngữ có `recognition: 'cloud'` trong registry; ngôn ngữ khác trả `LANGUAGE_NOT_CLOUD` (400)
- Giới hạn: câu tối đa 25,5 giây (`AUDIO_TOO_LARGE`, 413; sidecar cắt ở 25 giây nhưng có thể dư một khung), số byte phải chẵn (PCM 16-bit, lẻ là 400), thân yêu cầu tối đa 2 MB, khoảng 10 yêu cầu/giây/người dùng (429, giới hạn trong bộ nhớ của tiến trình)
- Bọc PCM thành WAV rồi gọi task `stt.transcribe` của `@cuelingo/ai-gateway`; lỗi nhà cung cấp trả `TRANSCRIBE_FAILED` (502)
- Không ghi đĩa, không log âm thanh hay văn bản (chỉ id và độ dài); `ai_call` không chứa nội dung

## Interface

- `POST /v1/sessions/:id/transcribe`: body `TranscribeRequestSchema` {segmentId, stream, startMs, endMs, sampleRate: 16000, pcm: base64 PCM 16-bit mono}, trả `TranscribeResponseSchema` {segmentId, text} (`text` rỗng khi không có tiếng nói)
- Client: `client.transcribe(sessionId, input)` trong `@cuelingo/core-sdk`
- Văn bản trả về đi tiếp bằng `segment.final` như họp tiếng Anh; realtime lưu câu nhưng không dịch ([realtime](./realtime.md))

## Phụ thuộc

- `@cuelingo/ai-gateway` (task `stt.transcribe`, Gemini, âm thanh gửi inline), `@cuelingo/prompts` (`stt/v1`)

## Dữ liệu & sự kiện

- Không có bảng mới; chỉ ghi `ai_call` (độ dài âm thanh, độ trễ, chi phí)

## Ngữ cảnh `previous`

Body có thể kèm `previous`: tối đa 3 câu đã nhận dạng trước đó của cùng luồng (mỗi câu tối đa 400 ký tự, cũ trước mới sau). Model chỉ dùng để chọn đúng tên riêng, thuật ngữ và chính tả, không được lặp lại; nội dung này không bao giờ được ghi log hay đưa vào `ai_call`.

## Câu hỏi mở

- Giới hạn tần suất đang ở trong bộ nhớ, không chia sẻ giữa nhiều tiến trình API
- Chất lượng và chi phí mỗi giờ họp cần đo sau cuộc họp thật đầu tiên
