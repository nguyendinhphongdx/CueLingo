# Debrief view

> Phần: [Web app](README.md) · Code: `apps/web/src/features/debrief/`

Hiển thị debrief sau họp và đưa cụm từ vào ôn tập.

## Trách nhiệm

- 5 khối: tóm tắt + action items, chỉ số hiểu, đoạn khó, cụm từ nên học, câu nên nói
- Nút "Thêm tất cả vào ôn tập"
- Nghe lại đoạn khó 0,75x/1x nếu có audio
- Phản hồi Hữu ích / Không hữu ích

## Phạm vi MVP

- US-11, US-12 (F4)

## Interface

- `GET /v1/sessions/:id/debrief`, `POST /v1/debriefs/:id/feedback`

## Phụ thuộc

- `@cuelingo/ui` (DebriefBlocks)

## Dữ liệu & sự kiện

- Events: `debrief_opened`, `debrief_feedback`

## Câu hỏi mở

- (chưa có)
