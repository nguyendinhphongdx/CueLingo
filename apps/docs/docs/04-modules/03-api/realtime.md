# Realtime gateway

> Phần: [API service](./README.md) · Code: `services/api/src/modules/realtime/`

WebSocket theo phiên: nhận transcript (hoặc audio), dịch từng câu final, đẩy bản dịch về client.

## Trách nhiệm

- Nhận `transcript.final` từ STT local, hoặc audio frame rồi chuyển sang STT cloud qua `ai-gateway`
- Dịch mỗi câu final kèm 3 câu trước + glossary
- Lưu segment, ghi event
- Backpressure, reconnect, đệm 60 giây

## Phạm vi MVP

- F2 — mục tiêu bản dịch p95 ≤ 2,5 giây

## Interface

- `WS /v1/sessions/:id/stream` — message schema trong `@cuelingo/shared/ws`

## Phụ thuộc

- `@cuelingo/ai-gateway`, `@cuelingo/prompts`

## Dữ liệu & sự kiện

- Events: `segment_final`, `translation_shown`

## Câu hỏi mở

- Gộp dịch theo cụm khi câu > 25 từ?
