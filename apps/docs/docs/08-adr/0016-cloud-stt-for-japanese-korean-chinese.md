# 0016 · Nhận dạng đám mây cho tiếng Nhật, Hàn, Trung

**Trạng thái:** Accepted · 2026-11-03 (chủ sản phẩm chọn trong phiên làm việc; mở rộng [ADR 0014](./0014-cloud-stt-for-vietnamese.md))

## Bối cảnh

[ADR 0014](./0014-cloud-stt-for-vietnamese.md) cho phép ngôn ngữ có `recognition: 'cloud'` trong registry được nhận dạng bằng đám mây, hiện chỉ tiếng Việt. Người dùng cần họp bằng tiếng Nhật, Hàn và Trung. Tiếng Nhật đang tắt vì chờ đánh giá nhận dạng trên máy (Parakeet); tiếng Hàn và Trung chưa có model nào chạy trên máy trong FluidAudio ngoài bản beta nặng.

## Quyết định

- Thêm tiếng Hàn (`ko`) và tiếng Trung (`zh`), và bật tiếng Nhật (`ja`), cả ba với `recognition: 'cloud'`: sidecar không tải model, tách câu trên máy, API gọi `stt.transcribe` ([ADR 0014](./0014-cloud-stt-for-vietnamese.md)); caption dịch sang tiếng Việt bằng tác vụ `translate.realtime` có sẵn.
- **Tiếng Nhật chuyển từ "chờ model trên máy" sang đám mây.** Model Parakeet tiếng Nhật vẫn nằm trong sidecar; bật lại khi có bộ đánh giá riêng và khi đó viết ADR mới thay mục này cho tiếng Nhật.
- Tiếng Hàn và Trung dùng cho họp, không dùng cho học (`learnable: false`); tiếng Nhật giữ như hiện tại.
- Dùng chung lời đồng ý một lần của ADR 0014, nêu rõ âm thanh gửi tới Google; chỉ báo "đang gửi âm thanh" suốt cuộc họp; không lưu âm thanh.
- Tiếng Trung ghi chữ giản thể; phồn thể để sau.

## Hệ quả

- Âm thanh cuộc họp tiếng Nhật, Hàn, Trung (cả micro và âm thanh hệ thống) rời máy, như tiếng Việt. Người dùng báo trước cho người dự họp.
- Caption trễ cỡ độ dài câu cộng 1,5 đến 2 giây, cộng thêm lượt dịch; không có chữ hiện dần.
- Chất lượng nhận dạng và dịch chỉ được kiểm nhanh bằng giọng tổng hợp (ghi trong hồ sơ `06-delivery/2026-11-03-languages-ko-zh-ja`), chưa có bộ đánh giá chuẩn.
