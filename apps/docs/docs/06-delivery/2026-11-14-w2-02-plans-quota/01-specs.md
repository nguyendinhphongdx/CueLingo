# w2-02-plans-quota — Gói Free/Pro/Ultra và hạn mức sử dụng

| Trạng thái | Loại    | Nhánh / PR                      | Ước lượng → thực tế |
| ---------- | ------- | ------------------------------- | ------------------- |
| Làm        | feature | `feat/w2-02-plans-quota` / _PR_ | L → ?               |

**Phạm vi:**

- **Trong:** gói của từng người (Free/Pro/Ultra) do admin gán tay; đếm lượng dùng theo tháng; chặn khi hết hạn mức; endpoint đọc lượng dùng; desktop và web hiện "còn lại" và cảnh báo khi gần hết.
- **Ngoài:**
  - Thanh toán, checkout, đổi gói tự phục vụ (W2-03, cần ADR nhà cung cấp W2-01).
  - Trang Giá công khai (W2-05).
  - **Xoá lịch sử sau 30 ngày** cho Free: xoá dữ liệu người dùng, cần spec riêng.
  - Debrief "rút gọn" khác "đầy đủ": chỉ đếm số bản, không đổi nội dung.

## 1. Vấn đề

Từ 2026-11-14 đăng ký đã mở (`INVITES_REQUIRED=false`). Mọi lời gọi AI chạy bằng một `GEMINI_API_KEY` của hệ thống. Ngoài trợ lý chat (đã có quota theo ngày), **không có trần nào cho từng người dùng**. Một tài khoản có thể dịch, nhận dạng tiếng Việt/Nhật/Hàn/Trung và tạo debrief không giới hạn, và chủ sản phẩm trả toàn bộ chi phí.

[Mô hình kinh doanh](../../02-product/05-business-model.md#phân-tích-gói-đề-xuất-chưa-chốt) đã đề xuất các gói và hạn mức, nhưng chưa có gì trong hệ thống để gán gói hay đếm lượng dùng. Người dùng cũng không biết mình còn bao nhiêu trước khi bị chặn.

**Người bị ảnh hưởng:**

- Chủ sản phẩm: chi phí AI không có trần.
- Người dùng beta: cần biết hạn mức và không bị cắt ngang giữa cuộc họp.

- **Spec liên quan:** [Mô hình kinh doanh](../../02-product/05-business-model.md), [Backlog W2-02, W2-04](../../02-product/06-backlog.md)
- **Module chạm tới:**
  - [sessions](../../04-modules/03-api/sessions.md), [realtime](../../04-modules/03-api/realtime.md), [transcribe](../../04-modules/03-api/transcribe.md)
  - [debrief](../../04-modules/03-api/debrief.md), [assist](../../04-modules/03-api/assist.md), [agent](../../04-modules/03-api/agent.md)
  - [admin](../../04-modules/03-api/admin.md), [shared](../../04-modules/05-packages/shared.md), [core-sdk](../../04-modules/05-packages/core-sdk.md)
  - Desktop và web

## 2. Tiêu chí chấp nhận (EARS)

Hạn mức theo [bảng gói](../../02-product/05-business-model.md#phân-tích-gói-đề-xuất-chưa-chốt), cấu hình được, không viết cứng rải rác. "Tháng" là tháng dương lịch theo giờ Việt Nam (xem Q2).

| #    | AC                                                                                                                                                                                                                                                                             | Test                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| AC1  | WHEN một người dùng được tạo THE SYSTEM SHALL gán gói `free`. Người dùng đã có trước migration cũng là `free`.                                                                                                                                                                 | `plans.test.ts` › default plan                      |
| AC2  | WHEN admin (trong `ADMIN_EMAILS`) đổi gói của một người sang `free`/`pro`/`ultra` THE SYSTEM SHALL áp hạn mức mới ngay ở lượt kiểm tiếp theo. IF người gọi không phải admin THEN trả `403`.                                                                                    | `plans.test.ts` › admin sets plan                   |
| AC3  | WHEN người dùng gọi `GET /v1/me/usage` THE SYSTEM SHALL trả gói hiện tại và, cho từng hạn mức (giờ dịch, giờ STT đám mây, số debrief, lượt tra từ/nói giúp hôm nay, tin trợ lý), `used`, `limit` (`null` = không giới hạn) và `resetsAt`. Chỉ tính dữ liệu của chính người đó. | `usage.test.ts` › returns own usage · user boundary |
| AC4  | WHILE người dùng còn giờ dịch THE SYSTEM SHALL dịch như hiện nay. Thời lượng câu `system` được dịch cộng vào giờ dịch của tháng.                                                                                                                                               | `realtime.test.ts` › counts translated time         |
| AC5  | IF người dùng hết giờ dịch THEN THE SYSTEM SHALL vẫn nhận và lưu câu (caption gốc vẫn chạy), không gọi AI dịch, và gửi cho client một message báo hết hạn mức đúng một lần mỗi phiên. Không đóng WebSocket.                                                                    | `realtime.test.ts` › quota exhausted keeps captions |
| AC6  | IF người dùng hết giờ STT đám mây THEN `POST /v1/sessions/:id/transcribe` trả `429` mã `QUOTA_EXCEEDED` với `details` là hạn mức đó, và không gọi AI.                                                                                                                          | `transcribe.test.ts` › quota exceeded               |
| AC7  | WHEN một phiên kết thúc IF người dùng đã dùng hết số debrief của tháng THEN THE SYSTEM SHALL không xếp job debrief. Phiên vẫn kết thúc bình thường, và `GET /v1/sessions/:id/debrief` cho biết debrief bị bỏ do hạn mức (không phải `404` chung).                              | `sessions.test.ts` › debrief skipped by quota       |
| AC8  | IF người dùng hết lượt tra từ/nói giúp trong ngày THEN các endpoint `assist` trả `429` `QUOTA_EXCEEDED`, và không gọi AI.                                                                                                                                                      | `assist.test.ts` › daily quota                      |
| AC9  | WHILE người dùng ở gói `free` THE SYSTEM SHALL từ chối lượt trợ lý chat (`429` `AGENT_QUOTA_EXCEEDED` như hiện nay). Gói `pro`/`ultra` dùng trần tin theo tháng của gói, ngoài trần ngày đang có.                                                                              | `agent.test.ts` › plan limits                       |
| AC10 | WHEN lượng dùng còn ≤ 10 phút dịch, hoặc ≤ 10% của một hạn mức khác, THE SYSTEM SHALL cho desktop hiện cảnh báo một lần mỗi phiên (tiếng Việt). Khi hết, desktop hiện "Đã hết giờ dịch tháng này, caption tiếng Anh vẫn chạy".                                                 | `overlay` / `usage` component test                  |
| AC11 | WHEN người dùng mở trang Cài đặt trên web THE SYSTEM SHALL hiện tên gói và thanh lượng dùng cho từng hạn mức.                                                                                                                                                                  | `UsagePanel.test.tsx`                               |
| AC12 | IF tài khoản thuộc `ADMIN_EMAILS` THEN THE SYSTEM SHALL không áp hạn mức (`limit: null`), để chủ sản phẩm thử app không bị chặn.                                                                                                                                               | `usage.test.ts` › admin unlimited                   |
| AC13 | WHEN người dùng xoá dữ liệu (`DELETE /v1/me/data`) THE SYSTEM SHALL **không** đặt lượng dùng tháng về 0. Khác quota trợ lý hiện nay, đây không phải lỗ hổng chấp nhận được khi đã thu tiền.                                                                                    | `privacy.test.ts` › usage survives data delete      |

Không log nội dung câu hay âm thanh khi đếm. Chỉ lưu con số (giây, số lần) gắn với `user_id`.

## 3. Câu hỏi mở

- [x] **Q1. Gán gói:** trong beta, admin gán tay qua API admin (chưa có UI admin). Có cần trang admin trên web không, hay chỉ API/SQL là đủ?
- [x] **Q2. Mốc tháng:** đề xuất ngày 1 dương lịch, giờ Việt Nam (UTC+7). Hay tính theo 30 ngày kể từ ngày đăng ký?
- [x] **Q3. Con số hạn mức:** dùng đúng bảng đề xuất (Free: 2 giờ dịch, 1 giờ STT đám mây, 8 debrief, 20 tra từ/ngày, không có trợ lý)? Hạn mức đặt bằng biến môi trường để đổi không cần deploy code.
- [x] **Q4. Người dùng beta hiện có:** cho tất cả lên `pro` miễn phí trong beta, hay để `free` như AC1?
- [x] **Q5. Hết giờ dịch giữa câu:** câu đang dịch dở thì dịch nốt (đề xuất), chỉ chặn từ câu sau.

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                                                                                       |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-14 | Spec | Mở hồ sơ. Làm hạn mức trước thanh toán: W2-02 trong backlog phụ thuộc W2-01 (ADR thanh toán), nhưng đăng ký đã mở nên cần trần chi phí ngay. Gói gán tay, chưa thu tiền.                                            |
| 2026-11-14 | Spec | Caption tiếng Anh (STT trên máy) không giới hạn ở mọi gói, vì nó không tốn chi phí server.                                                                                                                          |
| 2026-11-14 | Spec | **Duyệt spec**, theo các đề xuất: Q1 chỉ API admin; Q2 ngày 1 giờ Việt Nam; Q3 đúng bảng gói, đặt bằng biến môi trường; Q4 người dùng hiện có ở `free` (theo AC1, admin nâng tay khi cần); Q5 dịch nốt câu đang dở. |
| 2026-11-14 | Plan | **Duyệt plan** (02-plan.md), gồm ADR 0022 và giả định G1–G8.                                                                                                                                                        |
