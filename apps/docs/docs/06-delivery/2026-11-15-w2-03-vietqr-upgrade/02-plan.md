# Plan — w2-03-vietqr-upgrade

## 1. Bối cảnh code

Convention: [api-module](../../05-engineering/conventions/api-module.md) · [shared-contract](../../05-engineering/conventions/shared-contract.md) · [web-feature](../../05-engineering/conventions/web-feature.md) · [shared-ui](../../05-engineering/conventions/shared-ui.md) · [privacy-security](../../05-engineering/conventions/privacy-security.md) · [native-desktop](../../05-engineering/conventions/native-desktop.md).

Module `billing` mới copy từ `services/api/src/modules/glossary/`. Route khai báo đường dẫn đầy đủ như `usage` và `invites`.

| Chỗ                                                                       | Hiện trạng                                                                          | Liên quan                                                    |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `infra/db/migrations/20261114090000_plans_usage.sql:3-8`                  | `user_plans(user_id, plan, set_by, updated_at)`. Không có hạn dùng, không ghi nguồn | Cần thêm `expires_at` và `source`                            |
| `modules/usage/usage.repository.ts:37-38, 55-60`                          | `snapshot` và `gate` đọc thẳng cột `plan`                                           | Hết hạn được tính lúc đọc, sửa đúng 2 câu này                |
| `usage.repository.ts:84-88`, `usage.service.ts:151-159`                   | `setPlan` chỉ ghi `plan`                                                            | AC10: admin ghi `source='manual'` và `expires_at` tuỳ chọn   |
| `services/workers/src/lib/usage.ts:22-27`                                 | Worker đọc lại `user_plans.plan` bằng câu SQL riêng                                 | Phải áp cùng luật hết hạn                                    |
| `packages/shared/src/plans.ts:82-105`                                     | `PlanLimitsEnvSchema`: env JSON → bảng hạn mức                                      | Làm mẫu cho `PLAN_PRICES`                                    |
| `packages/shared/src/dto/usage.dto.ts`                                    | `UsageResponseSchema` đang `.strict()`                                              | Thêm trường vào đây làm hỏng client cũ khi parse             |
| `services/api/src/lib/auth.ts:21-27`                                      | Danh sách `isPublic`                                                                | Thêm đúng một URL webhook                                    |
| `services/api/src/app.ts:45-58, 148, 165-169`                             | `LOG_REDACT` đã che `body`; đây là chỗ nối module `usage`                           | Nối `billing`; che thêm `signature`                          |
| `services/api/src/config.ts:44, 87-90`                                    | Có `PLAN_LIMITS` và mẫu kiểm "nhóm biến phải đặt cùng nhau"                         | `PAYOS_*`: đặt đủ cả ba hoặc không đặt biến nào              |
| `modules/auth/auth.mailer.ts:14-41`                                       | Service API gọi `fetch`, có tiêm vào để test                                        | Tiền lệ cho adapter PayOS                                    |
| `services/api/src/scripts/`                                               | `invite.ts`, `enqueue.ts`                                                           | Chỗ đặt script đăng ký webhook                               |
| `apps/web/next.config.ts:6-9`, `src/lib/csp.ts:37`                        | Web xuất tĩnh; CSP `img-src 'self' data:`                                           | Route dùng query (`/checkout?order=`); QR vẽ ngay trên trang |
| `packages/ui/src/components/usage-meter.tsx:68-87`                        | `UsageSummary` dùng chung cho web và desktop                                        | Nhắc hết hạn (AC7) và nút "Nâng gói"                         |
| `apps/desktop/src-tauri/src/commands.rs:205-217`, `src/lib/native.ts:253` | `open_external` đã cho mở `https://`; có sẵn `webUrl`                               | Q5 không cần sửa Rust                                        |
| Repo                                                                      | Chưa có thư viện QR                                                                 | Thêm phụ thuộc mới, cần kiểm license                         |

## 2. Phương án

| #     | Câu hỏi                     | Phương án                                                                                                                                                                                                                | Ưu                                                                       | Nhược                                                            |
| ----- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 1A ✅ | Gói hết hạn                 | Thêm `user_plans.expires_at` và `source`. Khi đọc, nếu `expires_at <= now()` thì coi là `free`                                                                                                                           | Đúng tới giây, không cần job, không xoá gì (AC7)                         | Phải sửa 2 câu SQL ở API và 1 câu ở worker                       |
| 1B    |                             | Job định kỳ hạ gói                                                                                                                                                                                                       | SQL đọc giữ nguyên                                                       | Trễ một chu kỳ; job hỏng thì người dùng có Pro miễn phí          |
| 2A ✅ | Mã đơn, chống trùng webhook | Dùng `SEQUENCE` bắt đầu từ 1000000; `order_code` và `provider_link_id` UNIQUE. Một transaction: `UPDATE … SET status='paid' WHERE id=… AND status='pending' RETURNING`, sau đó `FOR UPDATE` trên `user_plans` rồi upsert | Webhook trùng hoặc song song chỉ cộng kỳ một lần (AC3)                   | Cần integration test                                             |
| 2B    |                             | Mã đơn sinh từ thời gian hoặc ngẫu nhiên, thêm bảng `webhook_events`                                                                                                                                                     | Không cần sequence                                                       | Có thể trùng mã; thêm một bảng                                   |
| 3A ✅ | Cổng nhà cung cấp (AC12)    | Interface `PaymentProvider { createCheckout, verifyWebhook, getStatus }`. Adapter `payos.ts` tự viết bằng `fetch` tiêm vào và `node:crypto`; thêm `fake.ts` cho test                                                     | Không thêm phụ thuộc; MoMo chỉ là thêm một adapter                       | Tự giữ code ký và xác minh                                       |
| 3B    |                             | Dùng SDK `@payos/node`                                                                                                                                                                                                   | Ít code                                                                  | Thêm phụ thuộc, khó tiêm cho test                                |
| 4A ✅ | Báo đã trả tiền (AC5)       | Client poll `GET /v1/billing/orders/:id` mỗi 3 s khi đơn đang pending. Server hỏi lại PayOS `getStatus` nếu lần hỏi trước đã quá 15 s                                                                                    | Đơn giản; vẫn chạy khi webhook chưa tới hoặc tunnel rớt                  | Mỗi 3 s một request, tối đa 15 phút                              |
| 4B    |                             | SSE                                                                                                                                                                                                                      | Báo ngay                                                                 | Cần pub/sub, vẫn phải có đường dự phòng                          |
| 5A ✅ | Q4: Pro → Ultra             | Hàm thuần `planAfterPurchase`: thời gian Pro còn lại × (giá Pro / giá Ultra) cộng vào kỳ Ultra; Ultra bắt đầu ngay                                                                                                       | Test được bằng hàm thuần; server quyết định                              | Cần một dòng giải thích trên UI                                  |
| 5B    |                             | Chỉ cho mua Ultra khi Pro đã hết                                                                                                                                                                                         | Rất đơn giản                                                             | Trái Q4 đã duyệt                                                 |
| 6A ✅ | Giá và kỳ                   | Mặc định đặt ở `packages/shared/src/billing.ts`; env `PLAN_PRICES` (JSON) ghi đè; chỉ API đọc                                                                                                                            | Một nguồn sự thật; chạy thật được với giá 2.000 ₫                        | Đổi giá phải khởi động lại                                       |
| 6B    |                             | Bảng `billing_prices`                                                                                                                                                                                                    | Đổi giá không cần deploy                                                 | Thêm bảng và màn hình admin, vượt phạm vi                        |
| 7A ✅ | QR                          | Vẽ chuỗi `qrCode` thành SVG ngay trên trang (thư viện nhỏ, MIT); kèm link phụ `checkoutUrl`                                                                                                                              | Hợp CSP; người dùng ở lại trang nên thấy được AC5                        | Thêm một phụ thuộc web                                           |
| 7B    |                             | Chuyển hẳn sang `checkoutUrl` của PayOS                                                                                                                                                                                  | Không cần thư viện                                                       | Rời app; khó đặt dòng "Quét bằng app ngân hàng hoặc MoMo" (AC12) |
| 8A ✅ | Hạn gói hiển thị ở client   | Endpoint mới `GET /v1/billing` trả `{enabled, current: {plan, expiresAt, source}, offers[]}`                                                                                                                             | Không đụng `UsageResponse` (strict); một endpoint phục vụ AC1, AC7, AC11 | Desktop gọi thêm một request                                     |
| 8B    |                             | Thêm `planExpiresAt` vào `UsageResponse`                                                                                                                                                                                 | Một request                                                              | Desktop đã cài bản có W2-02 sẽ parse lỗi                         |

**Chọn:** 1A · 2A · 3A · 4A · 5A · 6A · 7A · 8A. Lý do: giá do server quyết định, hệ thống đúng mà không phụ thuộc job nền nào, và MoMo cắm vào sau qua `providers/`.

**Thông số khác:**

| Mục                       | Giá trị                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Hạn thanh toán của đơn    | 15 phút, gửi sang PayOS bằng `expiredAt`                                               |
| `returnUrl` / `cancelUrl` | `${WEB_ORIGIN}/checkout?order=<uuid>`; `cancelUrl` thêm `&cancelled=1`                 |
| Nội dung chuyển khoản     | `CL<orderCode>`: 9 ký tự, vừa giới hạn của PayOS khi tài khoản không liên kết          |
| Một kỳ                    | Tháng lịch theo giờ VN; tháng sau ngắn hơn thì lấy ngày cuối tháng; một năm = 12 tháng |

**ADR 0023 — PayOS cho thanh toán VietQR** (viết ở bước 1):

- Phương án đã cân nhắc: Paddle/Lemon Squeezy, SePay/Casso, MoMo Business, gán gói tay.
- Dữ liệu gửi cho PayOS: chỉ `orderCode`, `amount`, `description`, `returnUrl`, `cancelUrl`. Không gửi email hay tên người dùng.
- Dữ liệu PayOS gửi về: tên và số tài khoản người chuyển bị bỏ ngay, không lưu, không log.
- Rủi ro: chưa rõ PayOS có nhận đăng ký cá nhân không.
- `billing_orders` vẫn giữ sau khi người dùng xoá dữ liệu, giống ADR 0022.

| Tác động       | Có?   | Chi tiết                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB migration   | Có    | `20261115090000_billing.sql`. `user_plans` thêm `expires_at timestamptz NULL` và `source text NOT NULL DEFAULT 'manual'` (`manual` hoặc `payment`). Thêm sequence `billing_order_code_seq` (1000000–9999999). Bảng `billing_orders`: `id`, `user_id` (CASCADE), `order_code` UNIQUE, `provider`, `plan` (pro/ultra), `period` (month/year), `amount` > 0, `status` (pending/paid/expired/cancelled), `provider_link_id` UNIQUE, `provider_ref`, `qr_code`, `checkout_url`, `expires_at`, `paid_at`, `plan_expires_at`, `created_at`; index `(user_id, created_at DESC)`. Chỉ thêm, có `down` |
| Contract       | Có    | `src/billing.ts` (thuần): `BillingPeriodSchema`, `DEFAULT_PLAN_PRICES`, `PlanPricesEnvSchema`, `addPeriod`, `planAfterPurchase`, `effectivePlan`. `dto/billing.dto.ts`: `BillingOverviewResponse`, `CreateOrderRequest {plan, period}` (strict), `BillingOrder`, `BillingOrderList`. `SetPlanRequest` thêm `expiresAt?`. Mã lỗi mới: `BILLING_DISABLED` (503), `BILLING_PROVIDER_FAILED` (502), `PLAN_DOWNGRADE` (409)                                                                                                                                                                       |
| Event / AI     | Không | Không có event mới, không gọi AI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Quyền riêng tư | Có    | Nhà cung cấp mới (ADR 0023, thêm vào danh sách trong `privacy-security.md`). Log chỉ ghi `orderCode` và kết quả. Không log khoá, chữ ký, `qrCode`, số tài khoản, tên người chuyển (AC11). `LOG_REDACT` thêm `signature`. Mọi endpoint mới cần đăng nhập, trừ webhook (xác minh bằng chữ ký)                                                                                                                                                                                                                                                                                                  |

## 3. Các bước (mỗi bước ≈ 1 commit)

| #   | Bước                               | File                                                                                                                                                                                                                | Điểm mở rộng   |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1   | ADR 0023 và danh sách nhà cung cấp | `08-adr/0023-payments-payos-vietqr.md`, `08-adr/README.md`, `05-engineering/conventions/privacy-security.md`                                                                                                        | ADR            |
| 2   | Contract và logic thuần            | `packages/shared/src/billing.ts(+test)`, `dto/billing.dto.ts(+test)`, `dto/usage.dto.ts` (`expiresAt?`), `errors/error-code.ts`, `index.ts`                                                                         | Contract       |
| 3   | Migration                          | `infra/db/migrations/20261115090000_billing.sql`                                                                                                                                                                    | Migration      |
| 4   | Hết hạn gói lúc đọc; AC10          | `modules/usage/usage.repository(.memory).ts`, `usage.service.ts`, test, `lib/errors.ts`                                                                                                                             | API module     |
| 5   | Worker dùng cùng luật hết hạn      | `services/workers/src/lib/usage.ts(+test)`                                                                                                                                                                          | Worker         |
| 6   | Cấu hình                           | `config.ts` (`PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` đi cùng nhau; `PLAN_PRICES`), `config.test.ts`                                                                                                | API module     |
| 7   | Cổng nhà cung cấp                  | `modules/billing/providers/{provider,payos,fake}.ts`, `payos.test.ts`: test bằng vector chữ ký cố định, so sánh bằng `timingSafeEqual`                                                                              | API module     |
| 8   | Module billing                     | `modules/billing/{index,routes,service,repository,repository.memory}.ts`, `billing.test.ts`, `billing.repository.int.test.ts`; sửa `app.ts`, `lib/auth.ts` (`/v1/billing/webhook/payos`), `server.ts`, `testing.ts` | API module     |
| 9   | Script đăng ký webhook             | `scripts/payos-confirm-webhook.ts`, lệnh `billing:confirm-webhook`                                                                                                                                                  | API module     |
| 10  | Client                             | `packages/core-sdk/src/billing.ts(+test)`                                                                                                                                                                           | Client         |
| 11  | UI dùng chung                      | `packages/ui/src/lib/usage.ts` (`planExpiryNotice`, `formatVnd`), `UsageSummary` thêm `planExpiresAt?` và `action?`                                                                                                 | `@cuelingo/ui` |
| 12  | Web                                | `features/billing/` (`PlanPicker`, `CheckoutPage`, `QrCode`, `OrderHistory`, `use-billing`, test), trang `/upgrade` và `/checkout`, nút và thông báo hết hạn trong `UsagePanel`, thư viện QR                        | Web feature    |
| 13  | Desktop                            | `src/usage/`: `billing-api.ts`; nút "Nâng gói" gọi `openExternal(webUrl + '/upgrade')`; thông báo hết hạn; test                                                                                                     | Desktop module |
| 14  | Hạ tầng và docs                    | `.env.example`, `infra/.env.tunnel.example`, `infra/compose.tunnel.yml`; docs `03-api/billing.md` (mới), `usage.md`, `deploy-tunnel.md`, `02-web/usage.md`, `01-desktop/settings.md`, `07-data-model.md`, backlog   | Docs           |

**Luồng của `billing.service.ts`:**

- **Tạo đơn** (`POST /v1/billing/orders`): nếu còn đơn pending cùng gói và kỳ thì trả lại đơn đó. Nếu không, ghi đơn với giá lấy từ cấu hình, rồi gọi `createCheckout`. PayOS lỗi thì đơn chuyển `cancelled` và trả 502. Mỗi người tối đa 10 đơn mỗi giờ.
- **Webhook** (`POST /v1/billing/webhook/payos`):
  - Chữ ký sai: trả 400.
  - `code !== '00'`: bỏ qua.
  - Mã đơn không tồn tại: xem G1.
  - Số tiền khác đơn: trả 400 và log cảnh báo.
  - Hợp lệ: `markPaidAndExtend`, trả 200.
- **Đọc đơn** (`GET /v1/billing/orders/:id`, lọc theo `userId`): đơn pending đã quá hạn thì đánh dấu `expired`. Đơn pending mà lần hỏi trước đã quá 15 s thì gọi `getStatus`, đi chung đường với webhook.
- **Lịch sử** (`GET /v1/billing/orders`): chỉ trả đơn của chính người gọi.

## 4. Rủi ro

| Rủi ro                                                             | Giảm thiểu                                                                                                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Webhook giả mạo (URL công khai)                                    | Kiểm HMAC-SHA256 trên `data`, so sánh bằng `timingSafeEqual`; sau đó vẫn đối chiếu `orderCode` và `amount` với DB. Có test vector cố định |
| Đua lệnh: webhook trùng, hoặc webhook và poll `getStatus` cùng lúc | Câu `UPDATE … WHERE status='pending'` chỉ cho một bên thắng; `FOR UPDATE` trên `user_plans`. Integration test chạy 5 lần song song        |
| Số tiền sai, client tự đặt giá                                     | `CreateOrderRequest` strict chỉ nhận `{plan, period}`; giá chụp vào đơn lúc tạo; webhook so khớp số tiền                                  |
| Chuyển tiền sau khi đơn hết hạn                                    | Vẫn nhận nếu `transactionDateTime` ≤ hạn đơn (G3). Ngoài khoảng đó thì log `orderCode` để hoàn tay                                        |
| PayOS không có sandbox                                             | Test tự động dùng `fake.ts`. Chạy thật với `PLAN_PRICES` 2.000 ₫, quét bằng app ngân hàng và MoMo, xong thì đặt lại giá thật              |
| Desktop cũ parse lỗi                                               | Không thêm trường vào `UsageResponse` (8A)                                                                                                |
| Worker vẫn đọc gói cũ                                              | Bước 5 nằm cùng PR, có test "gói hết hạn thì debrief theo hạn mức Free"                                                                   |
| Lộ dữ liệu ngân hàng trong log                                     | Body đã bị che; adapter bỏ `counterAccount*` và `virtualAccount*` ngay khi nhận; có test log                                              |
| PayOS không nhận đăng ký cá nhân (Q1)                              | Ghi vào ADR. Thiếu khoá thì nút bị ẩn (AC11), code không phụ thuộc                                                                        |

## 5. Test theo AC

| AC   | Test                                                                                                                               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- |
| AC1  | `PlanPicker.test.tsx` · `billing.test.ts` › overview                                                                               |
| AC2  | `billing.test.ts` › create order · giá lấy từ server (body có `amount` thì trả 400) · dùng lại đơn pending                         |
| AC3  | `billing.test.ts` › webhook paid · idempotent · `billing.repository.int.test.ts` › webhook song song                               |
| AC4  | `billing.test.ts` › rejects bad webhook · log chỉ có `orderCode` · `payos.test.ts` › signature vectors                             |
| AC5  | `CheckoutPage.test.tsx` (pending → paid, ngừng poll) · `billing.test.ts` › getStatus fallback                                      |
| AC6  | `billing.test.ts` › order expiry                                                                                                   |
| AC7  | `usage.test.ts` › paid plan expires · worker test · `usage-meter.test.tsx` › nhắc khi còn ≤ 3 ngày · desktop `UsagePanel.test.tsx` |
| AC8  | `billing.test.ts` › extend · `shared/billing.test.ts` › planAfterPurchase                                                          |
| AC9  | `billing.test.ts` › user boundary                                                                                                  |
| AC10 | `plans.test.ts` (thêm `expiresAt`, gói gán tay không hết hạn)                                                                      |
| AC11 | `config.test.ts` · `billing.test.ts` › disabled · UI ẩn nút                                                                        |
| AC12 | Toàn bộ `billing.test.ts` chạy với `fake.ts` · `CheckoutPage.test.tsx` có dòng nhắc MoMo · chạy thật bằng app MoMo                 |

## 6. Giả định cần duyệt

| #   | Giả định                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | **Sửa chữ AC4:** mã đơn không tồn tại nhưng chữ ký **hợp lệ** thì trả 200 và không đổi gì, vì `confirm-webhook` của PayOS gửi giao dịch mẫu và cần nhận 2xx. Chữ ký sai hoặc sai số tiền vẫn trả lỗi |
| G2  | Đang có Ultra còn hạn mà mua Pro thì trả 409 `PLAN_DOWNGRADE` và UI ẩn lựa chọn này. Gói gán tay không có hạn mà mua cùng gói hoặc gói thấp hơn cũng trả 409                                         |
| G3  | Nhận thanh toán nếu `transactionDateTime` ≤ hạn đơn, kể cả khi webhook tới muộn                                                                                                                      |
| G4  | Kỳ tính theo tháng lịch giờ VN; một năm = 12 tháng                                                                                                                                                   |
| G5  | `billing_orders` không bị `DELETE /v1/me/data` xoá và không có trong bản export; mất khi xoá tài khoản                                                                                               |
| G6  | Nút "Nâng gói" đợt này đặt ở `UsagePanel` (web và desktop) và trong thông báo `QUOTA_EXCEEDED` trên web                                                                                              |
| G7  | Mở web từ desktop: nếu chưa đăng nhập trên web thì đăng nhập lại; không truyền token qua URL                                                                                                         |

## 7. Việc chủ sản phẩm phải làm

1. Đăng ký PayOS và gắn tài khoản ngân hàng nhận tiền. Kiểm xem cá nhân có đăng ký được không (Q1); kết quả ghi vào ADR 0023.
2. Đặt ba khoá `PAYOS_*` vào `infra/.env.tunnel`. Không dán khoá vào chat.
3. Chạy `pnpm --filter @cuelingo/api billing:confirm-webhook`, hoặc đăng ký webhook trên dashboard PayOS.
4. Chạy thật với giá 2.000 ₫: trả bằng app ngân hàng và bằng MoMo; xong thì xoá `PLAN_PRICES`.
