# Debrief view

> Phần: [Web app](./README.md) · Code: `apps/web/src/features/debrief/`

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

## Soạn follow-up

Khi debrief đã sẵn sàng, nút "Soạn follow-up" cạnh "Sao chép cả debrief" mở thành phần soạn tin dùng chung (`FollowupComposer` trong `@cuelingo/ui`): chọn kênh (Email, Tin nhắn nhóm) và giọng (Ngắn gọn, Lịch sự, Thân mật), bấm "Soạn", sửa bản nháp rồi "Sao chép". Gọi `client.followup` ([API](../03-api/followup.md)); hiện cho cuộc họp mọi ngôn ngữ. Lỗi hiện thông báo chung và nút "Thử lại", không mất phần đã sửa. Luôn có dòng "Kiểm tra lại trước khi gửi."

## Câu hỏi mở

- (chưa có)
