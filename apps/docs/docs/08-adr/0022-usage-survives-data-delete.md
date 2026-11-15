# 0022 · Lượng dùng tính theo gói còn lại sau khi xoá dữ liệu

**Trạng thái:** Accepted · 2026-11-14 (duyệt cùng plan của hồ sơ [w2-02-plans-quota](../06-delivery/2026-11-14-w2-02-plans-quota/02-plan.md))

## Bối cảnh

Đăng ký đã mở và mọi lời gọi AI chạy bằng khoá của hệ thống, nên cần trần cho từng người: giờ dịch, giờ STT đám mây, số debrief, lượt tra từ/nói giúp và tin trợ lý, theo gói Free/Pro/Ultra. Quota trợ lý hiện nay đếm từ `agent_messages` và event `ai_call`, nên `DELETE /v1/me/data` đưa nó về 0. Với hạn mức sẽ thu tiền, đó là lỗ hổng: xoá dữ liệu rồi dùng tiếp.

## Quyết định

- Lượng dùng nằm ở bảng riêng `usage_counters(user_id, period_start, metric, amount)`. Bảng chỉ chứa con số và `user_id`, không có nội dung câu, âm thanh hay token.
- `DELETE /v1/me/data` **không** xoá `usage_counters` và `user_plans`. Xoá tài khoản vẫn xoá hết (cascade theo `auth_user`).
- Counter không nằm trong `GET /v1/me/export`; người dùng đọc qua `GET /v1/me/usage`.
- Hạn mức đếm theo lượt được giữ chỗ nguyên tử bằng một câu `INSERT … ON CONFLICT DO UPDATE … WHERE amount < limit`.

## Phương án đã cân nhắc

- Tính lại từ `segments`, `events`, `debriefs`: không thêm bảng nhưng bị xoá theo dữ liệu, trái mục tiêu.
- Gắn counter vào `sessions` rồi giữ lại bản ghi rỗng: lẫn dữ liệu nội dung với dữ liệu tính tiền.

## Hệ quả

- Chính sách quyền riêng tư phải nêu: hệ thống giữ số liệu lượng dùng (không nội dung) sau khi xoá dữ liệu, cho đến khi xoá tài khoản.
- Xoá tài khoản rồi đăng ký lại sẽ có hạn mức mới. Ngoài phạm vi W2-02, xử lý cùng thanh toán (W2-03).
- Trần ngày của trợ lý chat vẫn đếm từ `agent_messages` (bị xoá theo dữ liệu); chỉ trần tháng của Pro/Ultra dùng counter.
