# Benchmark

> Phần: [ML & evaluation](README.md) · Code: `ml/bench/`

Benchmark STT và dịch EN→VI trên máy local.

## Trách nhiệm

- Tải tập test (AMI, Earnings-22, IWSLT'15)
- Đo WER, tốc độ STT
- Đo COMET, chrF++, BLEU, độ trễ dịch

## Phạm vi MVP

- Đã chạy 31/10/2026, kết quả trong `ml/bench/results/`

## Interface

- `python stt_bench.py <model>`, `python mt_bench.py <model>`, `python comet_score.py`

## Phụ thuộc

- mlx-whisper, parakeet-mlx, mlx-lm, sacrebleu, unbabel-comet

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- Thêm đo streaming thật và so với API cloud
