# Debrief job

> Phần: [Workers](./README.md) · Code: `services/workers/src/jobs/debrief/`

Phân tích cuộc họp sau khi kết thúc, tạo debrief JSON.

## Trách nhiệm

- Lấy transcript + event của phiên
- Chọn đoạn khó từ tín hiệu (lookup, recap, translation_expanded)
- Gọi LLM debrief theo schema trong `@cuelingo/prompts`, validate, thử lại khi sai
- Tính `comprehension_pct`, gửi thông báo

## Phạm vi MVP

- F4 — ≤ 2 phút cho cuộc họp 60 phút

## Interface

- Job `debrief.generate {sessionId}`

## Phụ thuộc

- `@cuelingo/ai-gateway`, `@cuelingo/prompts`, `@cuelingo/learner-model`

## Dữ liệu & sự kiện

- Ghi bảng `debriefs`

## Câu hỏi mở

- Chạy lại diarization offline (pyannote) cho debrief? Cần Python worker
