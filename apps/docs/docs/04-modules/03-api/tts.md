# TTS (giọng đọc)

> Phần: [API service](./README.md) · Code: `services/api/src/modules/tts/`

Đọc một câu tiếng Anh thành âm thanh, cho bài nghe–gõ, nghe phát âm cụm từ và bài đánh giá đầu vào.

## Trách nhiệm

- Nhận văn bản ngắn và trả file WAV.
- Lưu file theo mã băm của văn bản: một câu chỉ tạo giọng một lần cho mọi người dùng.
- Giữ chi phí trong tầm tay: tối đa 20 lần **tạo mới** mỗi phút cho mỗi người (lần lấy từ bộ nhớ đệm miễn phí), các yêu cầu đồng thời cùng một câu dùng chung một lần tạo.

## Interface

| Method | Path      | Contract                                             | Ghi chú                                                                   |
| ------ | --------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `POST` | `/v1/tts` | `TtsRequest` (`{ text }`, 1–300 ký tự) → `audio/wav` | Header `x-tts-cache: hit\|miss`, `cache-control: private, max-age=604800` |

Văn bản nằm trong **body**, không nằm trong URL, để thứ người dùng luyện không vào log. Client lấy về dạng blob rồi phát bằng `<audio>`.

Lỗi: `400` văn bản không hợp lệ, `401` chưa đăng nhập, `429 RATE_LIMITED` tạo mới quá nhanh, `502 TTS_FAILED` nhà cung cấp lỗi.

## Phụ thuộc

- `@cuelingo/ai-gateway` `speech()`: model chính `gemini-3.8-flash-lite-tts`, dự phòng `gemini-3.8-flash-tts` (đổi bằng `AI_TTS_MODEL`, `AI_TTS_FALLBACK_MODEL`). Giọng mặc định `Kore`. Khoá API gửi trong header, không nằm trong URL.
- Bộ nhớ đệm file: thư mục `TTS_CACHE_DIR` (mặc định thư mục tạm của hệ thống). Một máy chủ thì đủ; nhiều máy chủ thì chuyển sang kho đối tượng.

## Dữ liệu & sự kiện

- Mỗi lần tạo mới ghi một sự kiện `ai_call` (`task=tts.speak`) để tính chi phí; chưa có bảng giá cho model giọng nên chi phí để trống.
- Đo thật: tạo một câu ngắn mất khoảng 2 giây, lấy từ bộ nhớ đệm gần như tức thì. Với bài ôn nên tạo trước giọng của các thẻ sắp đến hạn.

## Câu hỏi mở

- Thêm giọng thứ hai (nam) cho bài nghe để quen nhiều giọng?
- Chuyển bộ nhớ đệm sang kho đối tượng khi có nhiều máy chủ.
