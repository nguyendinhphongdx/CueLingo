# Billing (nâng gói)

> Phần: [Web app](./README.md) · Code: `apps/web/src/features/billing/` · Spec: `06-delivery/2026-11-15-w2-03-vietqr-upgrade` (AC1, AC5, AC6, AC9, AC11, AC12) · API: [billing](../03-api/billing.md)

Người dùng tự nâng Pro/Ultra bằng chuyển khoản VietQR (PayOS). Giá, hạn mức và đơn đều do server quyết định; web chỉ hiển thị.

## Trang

| Route                                | Component      | Việc                                                                                   |
| ------------------------------------ | -------------- | -------------------------------------------------------------------------------------- |
| `/upgrade`                           | `UpgradePage`  | `PlanPicker` + lịch sử `OrderHistory`. Chọn xong gọi `createOrder` rồi vào `/checkout` |
| `/checkout?order=<id>[&cancelled=1]` | `CheckoutPage` | QR, số tiền, nội dung chuyển khoản, đếm ngược 15 phút, trạng thái đơn                  |

Web xuất tĩnh nên `/checkout` đọc `?order=` bằng `useSearchParams` (trong `Suspense`), không có route động. `returnUrl` của PayOS là `<WEB_ORIGIN>/checkout?order=<id>`, `cancelUrl` thêm `&cancelled=1`.

## Thành phần

| Thành phần       | Vai trò                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlanPicker`     | Thuần. Pro/Ultra × tháng/năm, giá VND và hạn mức lấy từ `offers`. Ghi "năm chỉ tính 10 tháng" chỉ khi giá năm = 10 × giá tháng. Đang có Pro còn hạn thì ghi phần Pro còn lại được quy đổi thành ngày Ultra                                                                                                                                                                                                                                                            |
| `CheckoutView`   | Thuần. `pending`: QR + "Quét bằng app ngân hàng hoặc MoMo" + link phụ "Mở trang thanh toán PayOS" (chỉ https). `paid` + `planApplied`: "Đã lên gói Pro đến dd/mm/yyyy"; `paid` mà `planApplied=false`: "Đã nhận tiền nhưng gói không đổi vì bạn đã có gói cao hơn. Chúng tôi sẽ liên hệ hoàn tiền.". `expired`: nút "Tạo đơn mới" và lời nhắc "Nếu bạn đã chuyển khoản, gói sẽ tự lên khi hệ thống nhận được tiền…". `cancelled` hoặc `cancelled=1`: thông báo đã huỷ |
| `QrCode`         | Vẽ chuỗi `qrCode` thành SVG nội tuyến (thư viện `uqr`), nên hợp CSP `img-src 'self' data:`. Đen trên trắng bất kể giao diện sáng/tối để camera quét được                                                                                                                                                                                                                                                                                                              |
| `OrderHistory`   | Thuần. Gói, kỳ, số tiền, trạng thái, ngày của đơn chính người dùng; đơn `pending` có link "Tiếp tục"                                                                                                                                                                                                                                                                                                                                                                  |
| `UpgradeLink`    | Nút "Nâng gói", ẩn khi `GET /v1/billing` trả `enabled: false`. Dùng ở `UsagePanel` và thông báo hết lượt debrief                                                                                                                                                                                                                                                                                                                                                      |
| `use-billing.ts` | `useBillingOverview`, `useOrders`, `useCreateOrder`, `useOrder(id)`: poll mỗi 3 s chỉ khi `pending`, đơn `expired` poll thưa 15 s trong 10 phút sau hạn (webhook tới muộn vẫn được nhận), rồi dừng; dừng hẳn khi `paid/cancelled`; `paid` thì làm mới `usage` và `billing`                                                                                                                                                                                            |

## Thư viện QR

`uqr` 0.1.3, license MIT, không phụ thuộc gói nào khác, ghim đúng phiên bản. Chỉ dùng `encode()` để lấy ma trận; việc vẽ SVG nằm trong `QrCode.tsx` (React tạo phần tử, không `dangerouslySetInnerHTML`).

## Lỗi

`describeError` có câu tiếng Việt cho `BILLING_DISABLED`, `PLAN_DOWNGRADE`, `BILLING_PROVIDER_FAILED`, `RATE_LIMITED`; không bao giờ hiện `error.message` của server.

## Test

`PlanPicker.test.tsx` (giá, hạn mức, chú thích năm, quy đổi Pro→Ultra, chọn đúng gói/kỳ), `CheckoutPage.test.tsx` (QR, MoMo, paid/expired/cancelled, poll 3 s rồi dừng khi `paid`, bằng React Query thật và đồng hồ giả), `OrderHistory.test.tsx`, `QrCode.test.tsx`, `lib/errors.test.ts`.
