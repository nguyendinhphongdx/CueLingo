# w1-02-followup — Soạn tin follow-up sau cuộc họp từ debrief

| Trạng thái | Loại    | Nhánh / PR             | Ước lượng → thực tế |
| ---------- | ------- | ---------------------- | ------------------- |
| Kết quả    | feature | `feat/m1-live-caption` | _1,5 ngày → ?_      |

**Phạm vi:** trong: nút "Soạn follow-up" ở trang debrief (web) và thẻ "Cuộc họp vừa xong" (desktop); hai kênh (email, tin nhắn nhóm); ba giọng; bản nháp bằng ngôn ngữ của cuộc họp, sửa được và sao chép được; task AI mới và endpoint mới · ngoài: tự gửi email hay tin nhắn, lưu bản nháp, đưa cụm từ người dùng đã lưu vào bản nháp tiếng Anh (để sau), dịch sang ngôn ngữ khác, đính kèm transcript.

## 1. Vấn đề

Sau mỗi cuộc họp người dùng phải tự viết tin gửi người tham dự: tóm tắt, những gì đã chốt, ai làm gì. Debrief đã có sẵn đúng các thông tin đó nhưng người dùng phải tự chép lại và tự diễn đạt. Với cuộc họp tiếng Anh, viết tin bằng tiếng Anh còn khó và mất thời gian hơn. Đây là việc người dùng làm **mỗi ngày làm việc**, nên nếu app làm giúp thì có thêm lý do mở app sau họp (lộ trình Đợt 1: "ra họp có việc để làm").

- **Spec liên quan:** `apps/docs/docs/02-product/04-roadmap.md` (Đợt 1), `06-backlog.md` (W1-02), `apps/docs/docs/03-architecture/06-ai-architecture.md`
- **Module chạm tới:** `03-api/debrief.md`, `03-api/assist.md` (cùng kiểu task), `05-packages/ai-gateway.md`, `05-packages/prompts.md`, `02-web/debrief.md`, `01-desktop/session-controller.md`

## 2. Tiêu chí chấp nhận (EARS)

| #   | AC                                                                                                                                                                          | Test                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| AC1 | WHEN người dùng yêu cầu follow-up cho cuộc họp của chính mình đã có debrief THE SYSTEM SHALL trả bản nháp bằng ngôn ngữ của cuộc họp trong p95 ≤ 6 giây                     | `followup.test.ts`, đo thật               |
| AC2 | WHEN kênh là email THE SYSTEM SHALL trả tiêu đề và nội dung; WHEN kênh là tin nhắn nhóm THE SYSTEM SHALL trả nội dung ngắn, không có tiêu đề                                | `followup.test.ts`, fixture prompt        |
| AC3 | THE SYSTEM SHALL cho chọn giọng ngắn gọn, lịch sự hoặc thân mật và bản nháp phản ánh giọng đã chọn                                                                          | fixture prompt                            |
| AC4 | THE SYSTEM SHALL chỉ dùng tóm tắt, quyết định và việc cần làm của debrief; không bịa quyết định, người phụ trách hay ngày hạn không có trong debrief                        | fixture prompt, `followup.test.ts`        |
| AC5 | IF cuộc họp không thuộc người dùng hoặc chưa có debrief THEN THE SYSTEM SHALL trả cùng một `404 Debrief not found` (không lộ phiên có tồn tại hay không) và không gọi model | `followup.test.ts` (ranh giới người dùng) |
| AC6 | THE SYSTEM SHALL không lưu bản nháp; log và `ai_call` không chứa nội dung debrief hay bản nháp                                                                              | `followup.test.ts` (bắt log)              |
| AC7 | WHEN bản nháp về THE SYSTEM SHALL hiện trong ô sửa được kèm nút "Sao chép"; IF lỗi THEN THE SYSTEM SHALL hiện thông báo và nút thử lại, không mất bản nháp đang sửa         | `Followup*.test.tsx` (web và desktop)     |
| AC8 | WHILE cuộc họp là tiếng Việt THE SYSTEM SHALL soạn bằng tiếng Việt; tiếng Anh thì tiếng Anh; tiếng Nhật thì tiếng Nhật                                                      | fixture prompt                            |

## 3. Câu hỏi mở

- [x] **Hai kênh** là "email" và "tin nhắn nhóm" (Slack, Teams, Zalo dùng chung một kiểu ngắn), hay bạn muốn tách riêng từng nền tảng? Chốt: email và tin nhắn nhóm (dùng chung cho Slack, Teams, Zalo).
- [x] **Ba giọng** (ngắn gọn, lịch sự, thân mật) có đủ không? Đề xuất mặc định "lịch sự" cho email, "ngắn gọn" cho tin nhắn nhóm. Chốt: ngắn gọn, lịch sự, thân mật; mặc định lịch sự cho email, ngắn gọn cho chat.
- [x] **Ngôn ngữ bản nháp:** luôn theo ngôn ngữ cuộc họp (đề xuất), hay cho người dùng chọn (ví dụ họp tiếng Việt nhưng gửi khách bằng tiếng Anh)? Chốt: theo ngôn ngữ cuộc họp; chọn ngôn ngữ khác để sau.
- [x] **Nhận xét "debrief tiếng Việt không có điểm học"** không ảnh hưởng, nhưng với họp tiếng Anh có nên đưa cụm từ người dùng đã lưu vào bản nháp ngay phiên bản đầu (đề xuất: để sau)? Chốt: để sau, không đưa cụm từ đã lưu vào bản nháp ở phiên bản đầu.
- [x] Chỗ đặt nút ở desktop: chỉ trong thẻ "Cuộc họp vừa xong", hay cả danh sách "Cuộc họp gần đây"? Chốt: thẻ "Cuộc họp vừa xong" (desktop) và trang debrief (web).

## Decision log

| Ngày       | Pha     | Quyết định / lý do bị từ chối                                                                                                                                                                                                                                            |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-03 | Spec    | Mở hồ sơ. Việc W1-02 của Đợt 1, bắt đầu vì dùng lại debrief và task AI sẵn có                                                                                                                                                                                            |
| 2026-11-03 | Spec    | Chủ sản phẩm duyệt spec ("Đúng, qua cổng"), dùng mặc định cho 5 câu hỏi mở                                                                                                                                                                                               |
| 2026-11-03 | Plan    | Chọn phương án A (module API `followup` + thành phần dùng chung); chủ sản phẩm duyệt ("Ổn, bắt đầu làm")                                                                                                                                                                 |
| 2026-11-03 | Kết quả | Review độc lập (Claude và Codex): sửa tiêu đề dự phòng sai ngôn ngữ, làm sạch dữ kiện đưa vào prompt, kiểm placeholder và độ dài chat, hạn 8 giây, giới hạn tần suất sau khi kiểm phiên, và các lỗi trạng thái bản nháp ở giao diện. AC5 viết lại thành một 404 duy nhất |
