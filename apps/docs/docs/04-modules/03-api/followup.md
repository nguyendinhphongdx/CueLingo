# Follow-up

> Phần: [API service](./README.md) · Code: `services/api/src/modules/followup/` · Hồ sơ: `06-delivery/2026-11-03-w1-02-followup`

Soạn bản nháp tin follow-up (email hoặc tin nhắn nhóm) từ debrief của một cuộc họp.

## Trách nhiệm

- Đọc debrief mới nhất của **chính người dùng** cho phiên đó (`userId` từ auth); phiên của người khác hoặc chưa có debrief đều trả `404 Debrief not found`, cùng một thông báo, không gọi model
- Gọi task `assist.followup` của `@cuelingo/ai-gateway` với tóm tắt, quyết định và việc cần làm của debrief; ngôn ngữ bản nháp là ngôn ngữ của cuộc họp
- Kênh `email` luôn có tiêu đề (thiếu thì lấy tiêu đề tóm tắt của debrief); kênh `chat` luôn `subject: null`
- Không lưu bản nháp; log chỉ ghi id, kênh, giọng và độ dài, `ai_call` không chứa nội dung

## Phạm vi

- W1-02 (Đợt 1). Ngoài phạm vi: tự gửi, lưu bản nháp, đưa cụm từ đã lưu vào bản nháp, dịch sang ngôn ngữ khác

## Interface

- `POST /v1/sessions/:id/followup`: body `FollowupRequestSchema` {channel: `email`|`chat`, tone: `brief`|`polite`|`friendly`}, trả `FollowupResponseSchema` {subject|null, body, language}
- Lỗi model hoặc đầu ra sai: `502 FOLLOWUP_FAILED`; vượt giới hạn tần suất (khoảng 6 yêu cầu/phút/người dùng, trong bộ nhớ của tiến trình): `429 RATE_LIMITED`
- Client: `client.followup(sessionId, input)` trong `@cuelingo/core-sdk`

## Phụ thuộc

- Module `debrief` và `sessions` qua `index.ts`; `@cuelingo/ai-gateway`, `@cuelingo/prompts` (`followup/v1`)

## Dữ liệu & sự kiện

- Không có bảng mới, không có event; chỉ `ai_call`

## Câu hỏi mở

- Giới hạn tần suất không chia sẻ giữa nhiều tiến trình API
- Chọn ngôn ngữ bản nháp khác ngôn ngữ cuộc họp (ví dụ họp tiếng Việt, gửi khách tiếng Anh) để sau
