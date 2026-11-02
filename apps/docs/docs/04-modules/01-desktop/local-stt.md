# Local STT

> Phần: [Desktop app](./README.md) · Code: `apps/desktop/native/macos-audio/Sources/LocalSTT/`

Nhận dạng giọng nói tiếng Anh ngay trên máy bằng Parakeet-TDT 0.6B v3 (CoreML/Neural Engine), phát partial và final.

## Trách nhiệm

- Chạy Parakeet-TDT 0.6B v3 qua FluidAudio trên Apple Neural Engine
- Streaming theo chunk, phát `partial` (chưa ổn định) và `final` (đã chốt) cho từng luồng
- Timestamp mức từ để overlay gạch chân từ khó và debrief nhảy tới đoạn
- Tải model lần đầu, kiểm tra checksum, báo tiến độ
- Chuyển sang cloud STT khi máy không đủ tài nguyên hoặc ngôn ngữ không hỗ trợ

## Phạm vi MVP

- F2; theo ADR-0003 (STT on-device mặc định)

## Interface

- `feed(stream, pcm, tsMs)`
- Sự kiện `transcript.partial` / `transcript.final` {stream, text, words[{w, startMs, endMs, conf}]}
- Thuật ngữ cá nhân: biến `CUELINGO_VOCAB` lúc khởi động hoặc dòng stdin `vocab ["SLA",...]` (thay hẳn danh sách). `VocabularyCorrector` sửa kết quả sau khi model chạy, cả partial lẫn final

## Phụ thuộc

- [FluidAudio](https://github.com/FluidInference/FluidAudio) (Apache-2.0)
- [Parakeet-TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) (CC-BY-4.0, cần ghi công)

## Dữ liệu & sự kiện

- Benchmark: AMI WER 7,95%, ~3 giây xử lý / phút audio trên M1 Pro (apps/docs/docs/07-research/benchmark-stt-mt.md)

## Giới hạn của bộ sửa thuật ngữ

- Chỉ xử lý **từ đơn từ 3 ký tự trở lên**; cụm nhiều từ bị bỏ qua (muốn hỗ trợ phải sửa `VocabularyCorrector`).
- Luật acronym và khoảng cách sửa viết cho tiếng Anh. Desktop hiện chỉ gửi thuật ngữ cho cuộc họp tiếng Anh; ngôn ngữ khác nhận danh sách rỗng cho tới khi có eval riêng.

## Câu hỏi mở

- Chưa đo độ trễ streaming thật và RAM khi chạy cùng app họp
- Diarization realtime cho audio hệ thống: để giai đoạn sau hay dùng FluidAudio?
