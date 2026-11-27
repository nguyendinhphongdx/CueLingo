# Meeting assist

> Phần: [API service](./README.md) · Code: `services/api/src/modules/meeting-assist/` · [ADR 0027](../../08-adr/0027-meeting-assist.md)

Trợ lý hỏi trong lúc họp: đồng ý, gom ngữ cảnh theo luật cố định, một lần gọi mô hình trả theo luồng, kiểm nhãn nguồn, lưu hỏi đáp.

## Interface

| Route                               | Việc                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `GET /v1/me/meeting-assist`         | `{enabled, consent}`; trả lời cả khi tính năng tắt                              |
| `PUT /v1/me/meeting-assist/consent` | `{granted}`; đồng ý lưu theo phiên bản `meeting-assist@v1`, rút lại là xoá dòng |
| `POST /v1/sessions/:id/questions`   | `{question ≤ 500, focus?: {segmentId?, text}, detail?}`, trả SSE                |

Sự kiện SSE: `status` (`searching`, `answering`) → `text_delta`… → `sources` → `done {status, questionId}`. Lỗi nhà cung cấp: `error {MEETING_ASSIST_FAILED}` rồi `done {error}`.

## Cổng kiểm (theo thứ tự, trước byte đầu tiên)

cờ (503 `MEETING_ASSIST_DISABLED`) → body (400) → đồng ý (403 `MEETING_ASSIST_CONSENT_REQUIRED`) → phiên của mình, chưa xoá (404; phiên đã kết thúc vẫn hỏi được) → mỗi người một câu (409) → `meeting_ask_daily` (429 `QUOTA_EXCEEDED`).

Lượt đã trừ không hoàn lại. Client ngắt kết nối là bấm Dừng: huỷ lời gọi, mở khoá "một câu mỗi người" ngay, lưu `stopped` cùng phần chữ đã có.

## Ngữ cảnh gửi đi

| Phần               | Luật (`retrieval.ts`)                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Cuộc họp đang chạy | Đuôi ~10.000 ký tự + câu cũ khớp từ khoá (kèm câu trước, sau) ~4.000 ký tự. Chỉ câu gốc, kèm tên người nói |
| Câu được chỉ vào   | Lấy câu đã lưu theo `segmentId` trong đúng phiên; không có thì dùng chữ client gửi (dữ liệu không tin cậy) |
| Thuật ngữ, cụm từ  | Chỉ mục xuất hiện trong câu hỏi hoặc transcript được gửi, ≤ 20 mỗi loại                                    |
| Cuộc họp trước     | 100 phiên mới nhất trong 180 ngày; tối đa 3 phiên, mỗi phiên ≤ 4 câu khớp kèm câu lân cận; ~4.000 ký tự    |
| Hỏi đáp trước      | 3 cặp gần nhất của phiên, câu trả lời cắt còn 600 ký tự                                                    |

Một phiên cũ cần khớp 2 từ khoá, hoặc 1 nếu câu hỏi nhắc tới quá khứ ("lần trước", "last time"…). Tìm câu khớp bằng `LIKE` trên câu gốc và bản dịch, chấm điểm thêm trên tiêu đề và chữ của debrief (chỉ giá trị, không tính tên trường JSON), `statement_timeout` 300 ms; quá giờ hoặc lỗi thì trả lời không có nguồn này.

## Nhãn nguồn (`citations.ts`)

Mô hình gắn `[n]` hoặc `[G]`. Server chỉ giữ số của nguồn đã đưa vào prompt; không còn nhãn thật nào thì ghi `general` (client hiện "Kiến thức chung (chưa kiểm chứng)"). Câu trả lời lưu đã bỏ nhãn, ≤ 6.000 ký tự.

## Phụ thuộc

`ai-gateway.ask` (task `meeting.ask`, prompt `meeting.ask@v1`), `sessions`, `glossary`, phrases (`review`), `usage`.

## Dữ liệu & cấu hình

- Bảng `meeting_questions`, `meeting_assist_consents`. `DELETE /v1/me/data` xoá cả hai; xoá tài khoản cascade; xuất qua [privacy](./privacy.md).
- Env `MEETING_ASSIST_ENABLED` (mặc định **tắt**; thiếu `GEMINI_API_KEY` cũng coi là tắt), `AI_MEETING_ASK_MODEL`, `AI_MEETING_ASK_FALLBACK_MODEL`.
- Log chỉ có id, số đếm, mili giây. Không log câu hỏi, câu trả lời, transcript.

## Giới hạn đã biết

- Tìm theo từ khoá: hỏi bằng từ đồng nghĩa có thể sót cuộc họp cũ.
- Khoá "một câu mỗi người" nằm trong bộ nhớ (đúng với một container, ADR 0011).
- Dòng `streaming` còn lại khi tiến trình chết được xuất ra là `error`.
- Chỉ có trần theo người, chưa có trần chi tiêu toàn hệ thống.
