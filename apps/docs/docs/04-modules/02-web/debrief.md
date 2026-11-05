# Debrief view

> Phần: [Web app](./README.md) · Code: `apps/web/src/features/debrief/`

Hiển thị debrief sau họp và đưa cụm từ vào ôn tập.

## Trách nhiệm

- 5 khối: tóm tắt + action items, chỉ số hiểu, đoạn khó, cụm từ nên học, câu nên nói
- Nút "Thêm tất cả vào ôn tập"
- Nghe lại đoạn khó 0,75x/1x nếu có audio
- Phản hồi Hữu ích / Không hữu ích
- Transcript hiện người nói từng câu, lọc theo người, đổi tên tại chỗ (mục [Người nói](#người-nói))

## Phạm vi MVP

- US-11, US-12 (F4)

## Interface

- `GET /v1/sessions/:id/debrief`, `POST /v1/debriefs/:id/feedback`, `PATCH /v1/sessions/:id/speakers/:speakerId` ([API](../03-api/speakers.md)), `POST /v1/sessions/:id/debrief` (tạo lại)

## Phụ thuộc

- `@cuelingo/ui` (DebriefBlocks)

## Dữ liệu & sự kiện

- Events: `debrief_opened`, `debrief_feedback`

## Soạn follow-up

Khi debrief đã sẵn sàng, nút "Soạn follow-up" cạnh "Sao chép cả debrief" mở thành phần soạn tin dùng chung (`FollowupComposer` trong `@cuelingo/ui`): chọn kênh (Email, Tin nhắn nhóm) và giọng (Ngắn gọn, Lịch sự, Thân mật), bấm "Soạn", sửa bản nháp rồi "Sao chép". Gọi `client.followup` ([API](../03-api/followup.md)); hiện cho cuộc họp mọi ngôn ngữ. Lỗi hiện thông báo chung và nút "Thử lại", không mất phần đã sửa. Luôn có dòng "Kiểm tra lại trước khi gửi."

## Người nói

| Việc             | Hành vi                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nhãn từng câu    | `SpeakerTag` (`@cuelingo/ui`), tên theo `speakerDisplayName`: "Tôi", tên đã đặt, "Speaker N", "Người khác". Câu cũ không có `speakerId` theo `source` (mic = "Tôi", system = "Người khác")                                                                                                                                                                                                                                                                                              |
| Bộ lọc           | Tất cả / Tôi / từng người trong `speakers[]` / Người khác, kèm số câu ("Người khác" ẩn khi không còn câu nào và đã có người được nhận ra). Bấm "đoạn khó" chuyển bộ lọc sang người nói của câu đó                                                                                                                                                                                                                                                                                       |
| Đổi tên          | Bấm nhãn thành ô nhập 1–40 ký tự (cắt khoảng trắng): Enter lưu, Esc hoặc rời ô để huỷ, để trống là bỏ tên. "Tôi" và "Người khác" không có nút đổi tên. Chỉ câu được bấm mở ô (các câu khác của người đó vẫn hiện nhãn), một ô tại một thời điểm. Lúc lưu ô chỉ đọc (giữ focus); lỗi hiện thông báo tiếng Việt, ô giữ nguyên để sửa. Đổi tên và lọc theo người chỉ có tác dụng khi phiên có người nói `speaker_N`, tức là khi cờ registry `labelsSpeakers` bật (hiện tắt ở mọi ngôn ngữ) |
| Cập nhật tại chỗ | Sau khi lưu, cache `['sessions', id]` thay hàng người nói nên mọi câu của người đó đổi tên cùng lúc                                                                                                                                                                                                                                                                                                                                                                                     |
| Tạo lại debrief  | Sau một lần đổi tên trở đi hiện một lời nhắc "Tạo lại debrief với tên mới" (nhiều lần đổi chỉ một lời nhắc), gọi `regenerateDebrief`; không tự tạo lại. Bấm xong, trang hỏi lại mỗi 5 giây (tối đa 90 giây) đến khi có debrief mới; quá 90 giây chưa có thì hiện "Chưa xong, thử lại" kèm nút bấm lại được. 429 hiện "Bạn bấm hơi nhanh…"                                                                                                                                               |
| Xuất markdown    | Dòng transcript dùng cùng tên người nói (`**00:05 · Lan**`), không còn "Họ"                                                                                                                                                                                                                                                                                                                                                                                                             |

## Ngôn ngữ cuộc họp và các khối

Trang dùng hai cờ của registry độc lập: `translates` quyết định có hiện dòng dịch và "Transcript song ngữ"; `learnable` quyết định có hiện các khối học (đoạn khó, cụm từ nên lưu, câu nên nói) và điểm hiểu. Họp tiếng Hàn và Trung hiện transcript song ngữ nhưng không có khối học; họp tiếng Việt không có cả hai; tiếng Anh và Nhật như cũ.

## Các trạng thái khi chưa có debrief

- Cuộc họp **đang chạy**: "Cuộc họp này chưa kết thúc. Debrief sẽ có sau khi cuộc họp dừng." (không quay, không đếm giây).
- Cuộc họp **đã kết thúc nhưng không có câu nào**: "Cuộc họp này không có câu nào được ghi nên không có debrief." (worker bỏ qua phiên trống).
- Đã kết thúc và có câu: "Đang tạo… N s" tối đa 90 giây; quá hạn thì "Debrief chưa tạo được." kèm nút **Tạo lại debrief** gọi `regenerateDebrief` rồi chờ lại. Lỗi 409 và 429 có thông báo riêng.
- Danh sách cuộc họp (web và desktop) dùng cùng nhãn: "Chưa kết thúc", "Không có nội dung", "Đang tạo debrief", "Đã có debrief" (`sessionListLabel` trong `@cuelingo/ui`). Danh sách chưa có số câu nên phiên kết thúc trong dưới 10 giây được coi là trống.

## Câu hỏi mở

- (chưa có)

## Sao chép cả debrief

"Sao chép cả debrief" cho Markdown của cả cuộc họp (`buildDebriefMarkdown`): tóm tắt, quyết định, việc cần làm, và transcript khi ô "Kèm transcript" được chọn. Không có audio và không có link tới phiên.
