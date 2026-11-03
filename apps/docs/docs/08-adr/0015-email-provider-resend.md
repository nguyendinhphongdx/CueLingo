# 0015 · Email đăng nhập (magic link) gửi qua Resend

**Trạng thái:** Proposed · 2026-11-03 (code đã nối từ trước; chờ chủ sản phẩm duyệt để hợp thức hoá)

## Bối cảnh

Đăng nhập bằng magic link ([ADR 0008](./0008-auth-better-auth.md)) cần gửi email. `services/api/src/modules/auth/auth.mailer.ts` hỗ trợ ba chế độ qua `MAIL_PROVIDER`: `console` (dev), `resend` và `smtp`. Chế độ `resend` đã có trong code và có test, nhưng việc đưa địa chỉ email người dùng và đường dẫn đăng nhập cho một nhà cung cấp mới chưa có ADR (luật 8 của `AGENTS.md`).

## Quyết định đề xuất

- Môi trường thật dùng Resend (`MAIL_PROVIDER=resend`) với tên miền gửi đã xác minh (`MAIL_FROM`); SMTP của nhà cung cấp khác vẫn là phương án thay thế qua cấu hình, không cần đổi code.
- Dữ liệu gửi cho Resend chỉ gồm: địa chỉ email của người đăng nhập, tiêu đề và nội dung thư (đường dẫn đăng nhập dùng một lần, hết hạn sau 5 phút). Không gửi transcript, âm thanh hay dữ liệu học.
- Khoá API chỉ nằm ở biến môi trường (`RESEND_API_KEY`), không log, không đưa vào thông báo lỗi (đã có test).
- Chỉ dùng nhà cung cấp có điều khoản xử lý dữ liệu rõ ràng; kiểm tra điều khoản của gói đang dùng trước khi mở cho người dùng ngoài.

## Hệ quả

- Cần xác minh tên miền gửi (SPF/DKIM) trước khi mở beta ([P2-23](../02-product/06-backlog.md)).
- Resend thấy địa chỉ email người đăng nhập; chính sách riêng tư phải nêu điều này ([W2-06](../02-product/06-backlog.md)).
- Muốn đổi nhà cung cấp thì đổi cấu hình hoặc viết ADR mới thay ADR này.
