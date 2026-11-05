# speaker-labels — Biết ai đang nói: "Tôi", "Speaker N" và đổi tên

| Trạng thái | Loại    | Nhánh / PR             | Ước lượng → thực tế |
| ---------- | ------- | ---------------------- | ------------------- |
| Kết quả    | feature | `feat/m1-live-caption` | _3 ngày → ?_        |

**Phạm vi:** trong: nhãn người nói trên caption (overlay), transcript và debrief; "Tôi" cho luồng mic; "Speaker N" cho người khác trong luồng hệ thống; đổi tên trong debrief · ngoài: nhận diện giọng qua nhiều cuộc họp, tên tự lấy từ lịch, nhãn người nói trong ôn tập.

## 1. Vấn đề

Họp nhiều người thì transcript và debrief không nói được ai quyết định, ai nhận việc. Hiện mỗi câu chỉ biết đến từ luồng `mic` (bạn) hay `system` (mọi người khác gộp một). Bảng `speakers` đã có trong DB từ migration đầu nhưng chưa được dùng.

- **Spec liên quan:** `02-product/03-mvp-scope.md` (US-05), `02-product/06-backlog.md` (P2-24, M2-05)
- **Module chạm tới:** `01-desktop/local-stt.md`, `01-desktop/overlay.md`, `03-api/transcribe.md`, `02-web/debrief.md`, worker `debrief`

## 2. Tiêu chí chấp nhận (EARS)

| #   | AC                                                                                                                                           | Test                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| AC1 | WHEN một câu đến từ luồng mic THE SYSTEM SHALL gắn nhãn "Tôi" trên caption, transcript và debrief                                            | `session-controller.test.ts` |
| AC2 | WHEN luồng hệ thống có nhiều người nói THE SYSTEM SHALL gắn "Speaker 1", "Speaker 2"… ổn định trong cùng một cuộc họp (cùng giọng cùng nhãn) | test dịch vụ, đo thật        |
| AC3 | IF không tách được người THEN THE SYSTEM SHALL không gắn nhãn sai: câu đó chỉ mang nhãn "Người khác"                                         | test dịch vụ                 |
| AC4 | WHEN người dùng đổi tên một người nói trong debrief THE SYSTEM SHALL cập nhật mọi câu của người đó và debrief tạo lại dùng tên mới           | `speakers.test.ts`, web test |
| AC5 | THE SYSTEM SHALL chỉ cho người dùng của phiên đọc và đổi tên người nói của phiên (ranh giới người dùng)                                      | test ranh giới               |
| AC6 | THE SYSTEM SHALL không lưu mẫu giọng hay vân giọng; chỉ lưu nhãn và tên do người dùng đặt                                                    | review quyền riêng tư        |
| AC7 | THE SYSTEM SHALL làm cả hai nhóm ngôn ngữ: model trên máy (en) và nhận dạng đám mây (vi, ja, ko, zh)                                         | test hai đường               |

## 3. Câu hỏi mở (mỗi câu có đề xuất)

- [x] **Cách tách người trong luồng hệ thống.** (A) **Nhờ Gemini gắn nhãn người nói khi nhận dạng** cho ngôn ngữ đám mây, và với tiếng Anh trên máy thì chỉ có "Tôi" và "Người khác" ở giai đoạn này; không thêm dịch vụ, không lưu vân giọng, độ chính xác trung bình. (B) Thêm model tách người trên máy (sherpa/pyannote qua sidecar): chính xác hơn, nặng, thêm phụ thuộc và phải qua ADR. **Đề xuất: A trước**, B khi có bộ đánh giá.
- [x] **Tiếng Anh trên máy chỉ có "Tôi" và "Người khác"** trong giai đoạn này, đúng chưa? Đề xuất: đúng, ghi rõ giới hạn.
- [x] **Đổi tên chỉ trong một cuộc họp**, không nhớ giữa các cuộc họp (để tránh lưu dữ liệu nhận dạng người). Đề xuất: đúng.
- [x] Giới hạn số người: tối đa 8 nhãn mỗi cuộc họp, vượt thì gộp vào "Người khác". Đề xuất: đúng.

## Decision log

| Ngày       | Pha     | Quyết định / lý do bị từ chối                                                                                                                                                                                                                                                                                                                          |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-04 | Spec    | Mở hồ sơ theo yêu cầu "làm hết" của chủ sản phẩm; đề xuất phương án A, chờ duyệt cổng spec                                                                                                                                                                                                                                                             |
| 2026-11-04 | Spec    | Chủ sản phẩm duyệt cổng spec ("Đúng, qua cổng"), dùng đề xuất A cho cả bốn câu hỏi mở                                                                                                                                                                                                                                                                  |
| 2026-11-04 | Plan    | Chủ sản phẩm duyệt plan và bốn giả định ("Ổn, bắt đầu làm"): migration nhỏ; **tiếng Anh gửi cả câu mic dạng văn bản (không âm thanh) lên server để có "Tôi"** (thay đổi dữ liệu quyền riêng tư, đã đồng ý); mô tả giọng chỉ trong RAM không tính là vân giọng; đổi tên không tự tạo lại debrief                                                        |
| 2026-11-05 | Kết quả | Đo bằng Gemini thật: phương án A2 gắn nhầm 33-67% (ngưỡng 10%), nên cờ `labelsSpeakers` tắt ở mọi ngôn ngữ; AC2 và AC3 chưa đạt, chờ chủ sản phẩm chọn A3, B hay C (xem `03-review.md`). Review độc lập: sửa ô đổi tên mở rồi đóng ngay, dòng "Đang tạo lại" có thể kẹt, tên trùng nhãn hệ thống bị từ chối, test ranh giới tích hợp dùng nhãn chưa có |
