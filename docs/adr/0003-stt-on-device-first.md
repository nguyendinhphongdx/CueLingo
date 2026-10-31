# 0003 · STT on-device mặc định

**Trạng thái:** Accepted · 2026-10-31

## Bối cảnh
Benchmark ngày 31/10/2026 trên M1 Pro: Parakeet-TDT 0.6B v3 đạt WER 7,95% trên AMI và xử lý 1 phút audio trong ~3 giây, tốt hơn Whisper large-v3-turbo trên dữ liệu họp. STT cloud là chi phí lớn nhất theo phút họp, và audio là dữ liệu nhạy cảm nhất.

## Quyết định
- Mặc định chạy STT tiếng Anh trên máy: Parakeet-TDT 0.6B v3 qua FluidAudio (CoreML/ANE).
- Client chỉ gửi văn bản câu final lên server.
- `ai-gateway` vẫn có `SttProvider` cloud làm dự phòng: máy yếu, ngôn ngữ không hỗ trợ, hoặc người dùng tự chọn.

## Hệ quả
- Giảm chi phí và tăng quyền riêng tư (audio không rời máy).
- Lần chạy đầu phải tải model (~vài trăm MB).
- Chưa đo streaming thật và RAM khi chạy cùng app họp. Cần đo ở tuần 1–2 trước khi chốt.
- Parakeet v3 chỉ hỗ trợ 25 ngôn ngữ châu Âu. Tiếng Nhật/Hàn/Việt cần model khác (Whisper, Qwen3-ASR).
- Phải ghi công theo CC-BY-4.0.
