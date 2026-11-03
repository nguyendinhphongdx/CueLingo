# 0014 · Nhận dạng đám mây cho ngôn ngữ chưa có model trên máy (tiếng Việt)

**Trạng thái:** Accepted · 2026-11-03 (chủ sản phẩm đồng ý trong phiên làm việc; xem lại sau lượt chạy thật đầu tiên)

## Bối cảnh

[ADR 0003](./0003-stt-on-device-first.md) chọn nhận dạng trên máy (Parakeet) làm mặc định để audio không rời máy, và cho phép chế độ đám mây dự phòng. Parakeet không có tiếng Việt. Chủ sản phẩm cần họp tiếng Việt có transcript lưu lại để làm brief cuối buổi, trong vài ngày. Model trên máy có tiếng Việt (Cohere Transcribe qua FluidAudio) còn là beta, nặng (khoảng 7 GB RAM) và xử lý theo cửa sổ 35 giây.

## Quyết định

- Ngôn ngữ nào có `recognition: 'cloud'` trong registry (hiện chỉ `vi`) được nhận dạng bằng đám mây: sidecar tách từng câu trên máy, gửi âm thanh của câu đó tới API, API gọi nhà cung cấp qua `@cuelingo/ai-gateway` (task `stt.transcribe`, hiện là Gemini).
- **Nhà cung cấp mới nhận âm thanh:** Gemini, đã dùng cho văn bản và TTS, nay nhận cả âm thanh cuộc họp.
- **Đồng ý trước:** người dùng xác nhận một lần trước cuộc họp tiếng Việt đầu tiên; không gửi âm thanh trước khi đồng ý. Trong lúc họp luôn hiện chỉ báo "đang gửi âm thanh tới Google".
- **Không lưu:** API chuyển tiếp âm thanh một câu cho nhà cung cấp rồi bỏ; không ghi đĩa, không ghi log nội dung (chỉ độ dài, thời gian, kết quả). Chỉ lưu văn bản vào segment của cuộc họp, như họp tiếng Anh.
- Chỉ nhận âm thanh cho phiên của chính người dùng; giới hạn kích thước và tần suất.
- Họp tiếng Việt không dịch (không có bước vi→vi) và không cập nhật Learner Model.

## Hệ quả

- Âm thanh của cả luồng mic và luồng hệ thống (kể cả người dự họp) rời máy. Người dùng chịu trách nhiệm báo người dự họp; hệ thống chỉ nhắc. Cần chính sách riêng tư và điều khoản phản ánh điều này trước khi mở công khai ([W2-06](../02-product/06-backlog.md)).
- Nhà cung cấp phải cam kết không huấn luyện trên dữ liệu khách hàng ([ADR 0006](./0006-no-audio-by-default.md)); kiểm tra điều khoản của gói API đang dùng trước khi mở cho người dùng khác.
- Độ trễ mỗi câu gồm cả đường mạng; mục tiêu p95 ≤ 4 giây sau khi câu kết thúc.
- Muốn đưa nhận dạng tiếng Việt về máy thì viết ADR mới thay ADR này (Cohere Transcribe hoặc model khác).
