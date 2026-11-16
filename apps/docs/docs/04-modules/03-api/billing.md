---
title: Nâng gói bằng VietQR
---

# Nâng gói bằng VietQR (billing)

> Phần: [API service](./README.md) · Code: `services/api/src/modules/billing/` · Spec: `06-delivery/2026-11-15-w2-03-vietqr-upgrade` · [ADR 0023](../../08-adr/0023-payments-payos-vietqr.md)

Người dùng tự mua Pro/Ultra bằng chuyển khoản VietQR qua PayOS, trả trước theo kỳ. Webhook xác nhận, gói tự hết hạn và về Free ([usage](./usage.md)). Không tự gia hạn: VietQR không trừ tiền định kỳ.

## Trách nhiệm

- Tạo đơn với **giá do server quyết định** (`PLAN_PRICES`, mặc định ở `packages/shared/src/billing.ts`), gọi nhà cung cấp lấy mã QR.
- Xác nhận thanh toán từ webhook có chữ ký; nếu webhook không tới, đường đọc đơn hỏi lại nhà cung cấp.
- Nâng gói (`user_plans`) cùng transaction với việc đánh dấu đơn `paid`.
- Lịch sử đơn của chính người dùng. Module [admin-users](./admin-users.md) đọc `listOrders(userId)` qua service để hiện đơn của một người cho admin (bỏ `qrCode`, `checkoutUrl`, `transferContent`) và đọc tổng đơn `paid` theo tháng; nó không ghi gì vào billing.
- Nhà cung cấp nằm sau cổng `PaymentProvider` (`providers/provider.ts`): `createCheckout`, `verifyWebhook`, `getStatus`. Có `payos.ts` (thật) và `fake.ts` (test). Thêm MoMo = thêm một adapter.

## Interface

| Method | Path                        | Ai gọi            | Kết quả                                                                                                                                      |
| ------ | --------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/billing`               | đã đăng nhập      | `BillingOverviewResponse` `{enabled, current:{plan, expiresAt \| null, source \| null}, offers[{plan, period, amount, limits}]}`             |
| POST   | `/v1/billing/orders`        | đã đăng nhập      | Body `CreateOrderRequest` **strict** `{plan: pro \| ultra, period: month \| year}` → `201` `BillingOrder`. Có `amount` trong body là `400`   |
| GET    | `/v1/billing/orders`        | đã đăng nhập      | `{items: BillingOrder[]}`: chỉ đơn của người gọi, mới nhất trước, tối đa 50                                                                  |
| GET    | `/v1/billing/orders/:id`    | đã đăng nhập      | `BillingOrder` của người gọi (`404` nếu là đơn người khác). Client poll mỗi 3 s khi `pending`                                                |
| POST   | `/v1/billing/webhook/payos` | PayOS (công khai) | `200 {ok:true}`. Xác thực bằng chữ ký, không bằng đăng nhập. Là route công khai **duy nhất** của module (`lib/auth.ts` so khớp đúng URL này) |

`BillingOrder`: `{id, plan, period, amount, status: pending | paid | expired | cancelled, transferContent (CL<orderCode>), qrCode, checkoutUrl, createdAt, expiresAt, paidAt, planExpiresAt, planApplied}`. `planApplied` suy ra từ `status='paid'` và `plan_expires_at` khác null (không thêm cột): `false` nghĩa là đã nhận tiền nhưng gói không đổi vì người dùng đã có gói cao hơn, cần hoàn tay. `qrCode` (chuỗi VietQR để client vẽ) và `checkoutUrl` chỉ có khi `pending`.

| Mã lỗi                    | HTTP | Khi nào                                                                              |
| ------------------------- | ---- | ------------------------------------------------------------------------------------ |
| `BILLING_DISABLED`        | 503  | Thiếu khoá PayOS (tạo đơn / webhook). `GET /v1/billing` vẫn 200 với `enabled: false` |
| `PLAN_DOWNGRADE`          | 409  | Mua gói thấp hơn gói đang còn hạn, hoặc cùng gói khi gói gán tay không có hạn        |
| `BILLING_PROVIDER_FAILED` | 502  | Nhà cung cấp không tạo được link; đơn chuyển `cancelled`                             |
| `RATE_LIMITED`            | 429  | Quá 10 đơn mới mỗi giờ                                                               |
| `VALIDATION_ERROR`        | 400  | Body sai; webhook sai chữ ký hoặc sai số tiền                                        |

## Luồng

1. **Tạo đơn.** Lỗi 409 nếu là hạ gói. Nếu còn đơn `pending` cùng gói và kỳ thì trả lại đơn đó. Nếu không: ghi đơn (giá chụp vào đơn, hết hạn sau 15 phút), gọi `createCheckout` với `description = CL<orderCode>`, `returnUrl = <WEB_ORIGIN>/checkout?order=<id>`.
2. **Webhook.** Chữ ký sai → 400. `code != '00'` → bỏ qua (200). Mã đơn không tồn tại nhưng chữ ký đúng → **200, không đổi gì** (PayOS gửi giao dịch mẫu khi đăng ký URL). Số tiền khác đơn → 400, log cảnh báo. Hợp lệ → `settle`.
3. **Đọc đơn.** Đơn `pending` mà lần hỏi trước quá 15 s thì gọi `getStatus`; `paid` đi chung đường `settle` với webhook. Quá hạn mà chưa trả → `expired`.
4. **`settle`** (một transaction): `UPDATE … SET status='paid' WHERE order_code=$1 AND status IN ('pending','expired')` (chỉ một bên thắng), khoá `user_plans` bằng `FOR UPDATE`, tính `planAfterPurchase`, ghi gói `source='payment'` và `plan_expires_at` của đơn. `reference` (mã giao dịch ngân hàng, không phải dữ liệu người chuyển) lưu vào `provider_ref` để đối soát tay; không log, không trả cho client. Webhook trùng hoặc song song không cộng kỳ hai lần.

Tiền chuyển trong hạn đơn (`transactionDateTime` ≤ `expires_at`) vẫn được nhận dù webhook tới muộn hoặc đơn đã bị đánh dấu `expired`. Ngoài hạn: không đổi gói, log `orderCode` để hoàn tay.

## Quy tắc gói (`packages/shared/src/billing.ts`)

| Tình huống                                    | Kết quả                                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------- |
| Đang Free hoặc gói đã hết hạn                 | Bắt đầu ngay, hết sau một kỳ                                                            |
| Mua lại đúng gói đang còn hạn                 | Cộng nối tiếp từ ngày hết hạn hiện tại                                                  |
| Pro → Ultra giữa kỳ                           | Ultra bắt đầu ngay; thời gian Pro còn lại × (giá tháng Pro / giá tháng Ultra) cộng thêm |
| Gói thấp hơn, hoặc cùng gói gán tay không hạn | Từ chối (`PLAN_DOWNGRADE`); không có lựa chọn này trong `offers`                        |

Kỳ tính theo tháng lịch giờ VN (31/1 + 1 tháng = 28/2); một năm = 12 tháng. Giá mặc định: Pro 99.000/990.000, Ultra 249.000/2.490.000 ₫ (tháng/năm).

## Cấu hình

| Biến                                                     | Ý nghĩa                                                                                      |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` | Đặt cả ba hoặc không đặt biến nào (thiếu một: API không khởi động). Không có = tắt tính năng |
| `PLAN_PRICES`                                            | JSON ghi đè giá, ví dụ `{"pro":{"month":2000}}` để chạy thật với 2.000 ₫                     |

Đăng ký webhook: `pnpm --filter @cuelingo/api billing:confirm-webhook [url]` ([hướng dẫn](./deploy-tunnel.md#đăng-ký-webhook-payos)).

Dựng lại hoặc khôi phục DB với cùng khoá PayOS: sequence `billing_order_code_seq` chạy lại từ 1000000 và PayOS từ chối `orderCode` trùng (502). Cách xử lý: [deploy-tunnel](./deploy-tunnel.md#dựng-lại-hoặc-khôi-phục-db-với-cùng-khoá-payos).

## Dữ liệu & quyền riêng tư

- Bảng `billing_orders` ([data model](../../03-architecture/07-data-model.md)). Không có dữ liệu ngân hàng của người chuyển: adapter bỏ `counterAccount*`, `virtualAccount*` ngay khi nhận.
- Gửi PayOS: `orderCode`, `amount`, `description`, `returnUrl`, `cancelUrl`, `expiredAt`. Không email, không tên.
- Log chỉ có `orderCode` và kết quả. Không log khoá, chữ ký, `qrCode`, số tài khoản, tên người chuyển; `LOG_REDACT` che `signature` và `body`.
- `DELETE /v1/me/data` không xoá đơn; xoá tài khoản thì xoá. Không có trong `GET /v1/me/export`.

## Test

`billing.test.ts` (nhà cung cấp giả: tổng quan, tạo đơn, giá từ server, webhook, idempotent, chữ ký sai, hết hạn, poll dự phòng, ranh giới người dùng, log), `providers/payos.test.ts` (vector chữ ký, adapter bằng `fetch` giả), `test/integration/billing.repository.int.test.ts` (webhook song song trên Postgres thật).
