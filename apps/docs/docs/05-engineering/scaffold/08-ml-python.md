---
title: ML (Python)
---

# Scaffold · ML (`ml/eval`, Python + uv)

**Kết quả:** `ml/eval` là một project Python quản lý bằng **uv**, chạy bộ eval hồi quy cho từng tác vụ AI (dịch, recap, debrief) trên fixture chung với `@cuelingo/prompts`, xuất bảng so sánh giữa các phiên bản prompt/model. `ml/bench` giữ nguyên dạng script đã chạy.

Thiết kế: [ml/eval](../../04-modules/06-ml/eval.md). Workflow dùng nó: [ai-task](../workflows/ai-task.md).

## Các bước

```bash
cd ml && uv init eval --package --python 3.12
cd eval && uv add sacrebleu unbabel-comet pydantic && uv add --dev ruff pytest
```

```text
ml/eval/
├── pyproject.toml
├── src/cuelingo_eval/
│   ├── cli.py            uv run cuelingo-eval --task translate --prompt v2 --model <id>
│   ├── tasks/<task>.py   tải fixture, gọi model, chấm điểm
│   └── report.py         bảng markdown để dán vào 03-review.md
└── tests/
```

- Fixture đọc từ `packages/prompts/src/<task>/fixtures/` (một nguồn duy nhất).
- Gọi model qua HTTP tới API nội bộ hoặc endpoint tương thích OpenAI, **không** nhúng khoá API vào code; khoá qua biến môi trường.
- Kết quả ghi `ml/eval/results/<task>/<date>-<prompt>-<model>.json` (commit bản tóm tắt, không commit dữ liệu thô lớn).

## Luật

- Chạy bằng `uv run`; không cài gói vào Python hệ thống.
- Đọc dữ liệu tải về bằng `python -I` (xem [ml](../../04-modules/06-ml/README.md)).
- MLX cần GPU: chạy ngoài sandbox.

## Definition of Done

- [ ] `uv run cuelingo-eval --task translate --prompt v1` chạy trên fixture, in bảng COMET/chrF++ và độ trễ.
- [ ] `uv run ruff check` và `uv run pytest` sạch.
- [ ] Workflow [ai-task](../workflows/ai-task.md) trỏ đúng lệnh này.
