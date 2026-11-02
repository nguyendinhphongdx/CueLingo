---
title: Thiết lập tài khoản thật (email và Google)
sidebar_position: 9
---

# Thiết lập tài khoản thật

Mặc định API chạy ở chế độ phát triển: link đăng nhập **chỉ in ra log**, không gửi email. Muốn người khác đăng nhập được, bạn cần một nhà cung cấp email. API hỗ trợ hai cách; chọn một.

## Cách 1 · Resend (đơn giản nhất)

1. Tạo tài khoản ở [resend.com](https://resend.com), vào **Domains**, thêm tên miền của bạn và thêm các bản ghi DNS họ yêu cầu (SPF, DKIM) rồi chờ xác minh.
2. Vào **API Keys**, tạo khoá có quyền gửi email.
3. Đặt vào `.env` của API:

```bash
MAIL_PROVIDER=resend
MAIL_FROM=CueLingo <login@ten-mien-cua-ban.com>
RESEND_API_KEY=re_...
```

Chưa có tên miền thì Resend cho gửi thử từ `onboarding@resend.dev`, nhưng **chỉ tới email chủ tài khoản Resend**. Đủ để tự thử, chưa đủ để người khác dùng.

## Cách 2 · SMTP

Dùng được với bất kỳ nhà cung cấp SMTP nào (Amazon SES, Mailgun, Google Workspace…).

```bash
MAIL_PROVIDER=smtp
MAIL_FROM=CueLingo <login@ten-mien-cua-ban.com>
SMTP_URL=smtps://tai-khoan:mat-khau@smtp.nha-cung-cap.com:465
```

Mật khẩu có ký tự đặc biệt thì mã hoá phần trăm (`@` thành `%40`). Với Gmail cần mật khẩu ứng dụng, không dùng mật khẩu thường.

## Kiểm tra

Khởi động lại API rồi gửi liên kết từ trang đăng nhập. Nếu nhà cung cấp từ chối (tên miền chưa xác minh, khoá sai), lỗi và lý do hiện ở log API; khoá không bao giờ được ghi vào log. Production **không khởi động** nếu `MAIL_PROVIDER=console`.

Giới hạn chống lạm dụng: tối đa 5 yêu cầu gửi link mỗi giờ cho mỗi địa chỉ và mạng ở production. Link dùng một lần và hết hạn sau 5 phút.

## Đăng nhập Google (tuỳ chọn)

1. Vào [Google Cloud Console](https://console.cloud.google.com/apis/credentials), tạo **OAuth client ID** loại **Web application**.
2. Thêm **Authorized redirect URI**: `http://localhost:4000/api/auth/callback/google` (khi chạy thật là `https://api.ten-mien/api/auth/callback/google`).
3. Đặt `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` (cả hai hoặc không đặt) rồi khởi động lại API. Nút "Đăng nhập bằng Google" tự hiện ở trang web khi `NEXT_PUBLIC_GOOGLE_ENABLED=true`.

## Khi chạy thật

Cần thêm: tên miền cho web và API dùng chung gốc (cookie đăng nhập), `WEB_ORIGIN`, `BETTER_AUTH_URL` trỏ đúng tên miền, và `BETTER_AUTH_SECRET` dài ngẫu nhiên riêng cho production.
