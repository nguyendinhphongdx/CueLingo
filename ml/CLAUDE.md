# CLAUDE.md — ml

Python 3.12 + uv, MLX trên Apple Silicon. Không chạy trong production.

- `bench/`: benchmark STT + dịch ([kết quả](../apps/docs/docs/07-research/02-benchmark-stt-mt.md)). Dữ liệu và model không commit.
- `eval/`: bộ test hồi quy cho prompt/model; chạy khi đổi model hoặc prompt.
- MLX cần GPU: chạy ngoài sandbox. Đọc dữ liệu tải về bằng `python -I`.
