# 0023 · Thanh toán VietQR qua PayOS

**Trạng thái:** Accepted · 2026-11-15 (duyệt cùng plan của hồ sơ [w2-03-vietqr-upgrade](../06-delivery/2026-11-15-w2-03-vietqr-upgrade/02-plan.md))

## Bối cảnh

Sau W2-02 đã có gói và hạn mức nhưng không có cách trả tiền; người dùng mục tiêu là người Việt, quen chuyển khoản bằng QR hơn thẻ quốc tế. Cần một nhà cung cấp nhận VietQR, báo kết quả bằng webhook có chữ ký, không đòi merchant doanh nghiệp. Chủ sản phẩm chọn PayOS (2026-11-15).

## Quyết định

- PayOS là nhà cung cấp thanh toán. Người dùng **trả trước theo kỳ** (tháng hoặc năm); VietQR không trừ tiền định kỳ nên không tự gia hạn.
- Nhà cung cấp nằm sau cổng `PaymentProvider` (`createCheckout`, `verifyWebhook`, `getStatus`) ở `services/api/src/modules/billing/providers/`; PayOS là adapter đầu tiên, MoMo (nếu cần) chỉ thêm adapter.
- Webhook xác minh bằng HMAC-SHA256 (Checksum Key) và so sánh `timingSafeEqual`, sau đó đối chiếu mã đơn và số tiền với DB. Khoá chỉ đọc từ biến môi trường `PAYOS_*`.
- Gói hết hạn được tính lúc đọc (`user_plans.expires_at`), không cần job nền.

## Dữ liệu

| Hướng        | Nội dung                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Gửi PayOS    | `orderCode`, `amount`, `description` (`CL<orderCode>`), `returnUrl`, `cancelUrl`, `expiredAt`. Không email, không tên                   |
| PayOS gửi về | Kết quả giao dịch. Tên, số tài khoản người chuyển (`counterAccount*`, `virtualAccount*`) bị bỏ ngay khi chuẩn hoá, không lưu, không log |
| Ta lưu       | `billing_orders`: gói, kỳ, số tiền, trạng thái, mã đơn, mã link, `qr_code`, `checkout_url`, thời điểm                                   |

## Phương án đã cân nhắc

| Phương án                      | Lý do không chọn                                                           |
| ------------------------------ | -------------------------------------------------------------------------- |
| Paddle / Lemon Squeezy         | Hướng thẻ quốc tế; người dùng Việt ngại, thuế/hoá đơn phức tạp             |
| SePay / Casso                  | Đối soát biến động số dư, tự giữ nhiều logic hơn, không có link thanh toán |
| MoMo Business                  | Cần merchant, thêm phí; người dùng MoMo vẫn quét được VietQR của PayOS     |
| Gán gói tay (hiện trạng W2-02) | Không đo được free → trả phí                                               |

## Hệ quả

- Rủi ro: PayOS cho cá nhân đăng ký bằng CCCD (đã kiểm trên trang đăng ký, 2026-11-15); điều kiện có thể đổi. Thiếu khoá `PAYOS_*` thì tính năng tự tắt, code không phụ thuộc.
- PayOS không có sandbox: test tự động dùng nhà cung cấp giả; chạy thật bằng giá 2.000 ₫ qua `PLAN_PRICES`.
- `billing_orders` vẫn còn sau `DELETE /v1/me/data`, giống [ADR 0022](./0022-usage-survives-data-delete.md), vì là chứng từ thu tiền; mất khi xoá tài khoản. Không có trong bản export.
- Chính sách quyền riêng tư phải nêu PayOS là bên nhận dữ liệu giao dịch.
