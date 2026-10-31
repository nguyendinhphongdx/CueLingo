# ML & evaluation

> Code: `ml/` · Stack: Python 3.12, uv, MLX (Apple Silicon) · Giai đoạn: Liên tục

Benchmark và đánh giá chất lượng model/prompt. Không chạy trong production.

## Modules

| Module                | Code    | Trách nhiệm                                                                                       |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| [Benchmark](bench.md) | `bench` | Benchmark STT và dịch EN→VI trên máy local.                                                       |
| [Eval](eval.md)       | `eval`  | Bộ test hồi quy cho prompt/model: dịch, recap, debrief. Chạy trước mỗi lần đổi model hoặc prompt. |

## Quan hệ với phần khác

Xem [sơ đồ hệ thống](../../00-overview/system-overview.md).
