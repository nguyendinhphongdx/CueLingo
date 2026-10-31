# Local STT

> Phần: [Desktop app](README.md) · Code: `apps/desktop/native/macos-audio/Sources/LocalSTT/`

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

## Phụ thuộc

- [FluidAudio](https://github.com/FluidInference/FluidAudio) (Apache-2.0)
- [Parakeet-TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) (CC-BY-4.0, cần ghi công)

## Dữ liệu & sự kiện

- Benchmark: AMI WER 7,95%, ~3 giây xử lý / phút audio trên M1 Pro (docs/04-research/benchmark-stt-mt.md)

## Câu hỏi mở

- Chưa đo độ trễ streaming thật và RAM khi chạy cùng app họp
- Diarization realtime cho audio hệ thống: để giai đoạn sau hay dùng FluidAudio?
