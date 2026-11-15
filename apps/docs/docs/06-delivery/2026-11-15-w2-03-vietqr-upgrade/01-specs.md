# w2-03-vietqr-upgrade — Tự nâng gói Pro/Ultra bằng VietQR (PayOS)

| Trạng thái | Loại    | Nhánh / PR                         | Ước lượng → thực tế |
| ---------- | ------- | ---------------------------------- | ------------------- |
| Làm        | feature | `feat/w2-03-vietqr-upgrade` / _PR_ | L → ?               |

**Phạm vi:**

- **Trong:**
  - ADR W2-01: chọn PayOS làm nhà cung cấp thanh toán (VietQR).
  - Người dùng tự mua gói Pro hoặc Ultra, trả trước theo kỳ.
  - Xác nhận thanh toán tự động qua webhook.
  - Gói tự hết hạn và trở về Free.
  - Lịch sử thanh toán của chính người dùng.
- **Ngoài:**
  - Tự gia hạn, trừ tiền định kỳ (VietQR không hỗ trợ).
  - Thẻ quốc tế.
  - Cổng MoMo Business riêng (W2-03b, khi beta cho thấy cần). Đợt này người dùng MoMo quét VietQR của PayOS.
  - Xuất hoá đơn VAT điện tử.
  - Hoàn tiền tự động (hoàn tay, ngoài hệ thống).
  - Gói Team.
  - Trang Giá công khai trên landing (W2-05). Màn hình mua trong app là đủ.

## 1. Vấn đề

Sau W2-02 đã có gói và hạn mức, nhưng người dùng muốn lên Pro/Ultra phải nhờ admin gán tay bằng API hoặc SQL. Không có cách trả tiền, nên không đo được free → trả phí, là cổng của Đợt 2 (≥ 3%).

Người dùng mục tiêu là người Việt, phần đông không có hoặc ngại dùng thẻ quốc tế; chuyển khoản ngân hàng bằng QR là cách quen thuộc nhất. Chủ sản phẩm đã chọn **VietQR qua PayOS** (2026-11-15).

**Người bị ảnh hưởng:**

- Người dùng Free muốn nâng gói.
- Chủ sản phẩm: cần thu tiền mà không phải đối soát tay.

**Spec liên quan:** [Mô hình kinh doanh](../../02-product/05-business-model.md#phân-tích-gói-đề-xuất-chưa-chốt), [Backlog W2-01, W2-03, W2-04](../../02-product/06-backlog.md), [W2-02](../2026-11-14-w2-02-plans-quota/01-specs.md)

**Module chạm tới:** [usage](../../04-modules/03-api/usage.md) (gói), module thanh toán mới ở API, [web usage](../../04-modules/02-web/usage.md), Cài đặt desktop, `@cuelingo/shared`, `@cuelingo/core-sdk`.

## 2. Tiêu chí chấp nhận (EARS)

| #    | AC                                                                                                                                                                                                                     | Test                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| AC1  | WHEN người dùng mở "Nâng gói" (web Cài đặt, hoặc từ thông báo hết hạn mức) THE SYSTEM SHALL hiện các lựa chọn Pro/Ultra × kỳ (Q2) kèm giá VND và hạn mức của từng gói, lấy từ server.                                  | `PlanPicker.test.tsx`                                                      |
| AC2  | WHEN người dùng chọn một lựa chọn THE SYSTEM SHALL tạo một đơn thanh toán có mã duy nhất và trả về mã VietQR cùng số tiền, nội dung chuyển khoản và hạn thanh toán. **Giá do server quyết định**, không lấy từ client. | `billing.test.ts` › create order · price from server                       |
| AC3  | WHEN PayOS gửi webhook báo đã thanh toán **và chữ ký hợp lệ** THE SYSTEM SHALL chuyển đơn sang `paid` và nâng gói của người dùng đến hết kỳ. Webhook trùng lặp không cộng kỳ hai lần.                                  | `billing.test.ts` › webhook paid · idempotent                              |
| AC4  | IF webhook có chữ ký sai, số tiền khác đơn, hoặc mã đơn không tồn tại THEN THE SYSTEM SHALL không đổi gói, trả lỗi cho PayOS và ghi log (chỉ mã đơn, không dữ liệu ngân hàng).                                         | `billing.test.ts` › rejects bad webhook                                    |
| AC5  | WHILE màn hình thanh toán đang mở THE SYSTEM SHALL tự cập nhật khi đơn chuyển `paid` (không cần tải lại trang) và hiện "Đã lên gói Pro đến dd/mm/yyyy".                                                                | `CheckoutPage.test.tsx`                                                    |
| AC6  | IF đơn quá hạn (Q3) mà chưa thanh toán THEN THE SYSTEM SHALL đánh dấu `expired` và không nhận thanh toán cho đơn đó nữa. Người dùng tạo đơn mới.                                                                       | `billing.test.ts` › order expiry                                           |
| AC7  | WHEN gói trả phí hết hạn THE SYSTEM SHALL áp hạn mức Free từ lượt kiểm tiếp theo, không xoá dữ liệu. Trước hạn 3 ngày, web và desktop báo "Gói Pro hết hạn ngày …".                                                    | `usage.test.ts` › paid plan expires · `UsageSummary` test                  |
| AC8  | WHEN người đang có gói trả phí mua thêm cùng gói THE SYSTEM SHALL cộng nối tiếp từ ngày hết hạn hiện tại. Mua gói cao hơn: xem Q4.                                                                                     | `billing.test.ts` › extend                                                 |
| AC9  | WHEN người dùng mở lịch sử thanh toán THE SYSTEM SHALL chỉ trả đơn của chính họ (gói, kỳ, số tiền, trạng thái, ngày).                                                                                                  | `billing.test.ts` › user boundary                                          |
| AC10 | WHEN admin gán gói tay (`PUT /v1/admin/plan`) THE SYSTEM SHALL vẫn hoạt động như W2-02; gói gán tay không hết hạn trừ khi admin đặt ngày.                                                                              | `plans.test.ts` (giữ)                                                      |
| AC11 | THE SYSTEM SHALL chỉ dùng khoá PayOS từ biến môi trường; không log khoá, chữ ký, số tài khoản hay tên người chuyển. Thiếu cấu hình PayOS thì ẩn nút "Nâng gói" thay vì báo lỗi.                                        | `config.test.ts`, `billing.test.ts` › disabled                             |
| AC12 | THE SYSTEM SHALL tách nhà cung cấp thanh toán sau một cổng (tạo đơn, xác minh webhook) để thêm MoMo sau này mà không đổi luồng đơn, gói, hết hạn. Màn hình QR ghi "Quét bằng app ngân hàng hoặc MoMo".                 | `billing.test.ts` dùng nhà cung cấp giả · chạy thật: quét QR bằng app MoMo |

## 3. Câu hỏi mở

- [x] **Q1. Tài khoản PayOS:** bạn đã có tài khoản PayOS gắn với tài khoản ngân hàng nhận tiền chưa? PayOS cho đăng ký bằng cá nhân hay cần hộ kinh doanh/doanh nghiệp: kiểm lại ở bước ADR. Khoá (Client ID, API Key, Checksum Key) bạn tự đặt vào `infra/.env.tunnel`, không gửi trong chat.
- [x] **Q2. Giá và kỳ:** đề xuất **Pro 99.000 ₫/tháng, 990.000 ₫/năm**; **Ultra 249.000 ₫/tháng, 2.490.000 ₫/năm** (năm = 10 tháng). Chốt con số nào?
- [x] **Q3. Hạn thanh toán của một đơn:** đề xuất 15 phút.
- [x] **Q4. Đổi Pro → Ultra giữa kỳ:** đề xuất bắt đầu Ultra ngay, phần Pro còn lại quy đổi thành ngày Ultra theo tỉ lệ giá. Hay đơn giản hơn: chỉ cho mua Ultra khi hết Pro?
- [x] **Q5. Mua từ desktop:** mở trang thanh toán web trong trình duyệt (đề xuất, ít việc), hay hiện QR ngay trong app desktop?
- [x] **Q6. Lượng dùng khi lên gói giữa tháng:** giữ nguyên số đã dùng trong tháng và áp hạn mức mới (đề xuất, ví dụ đã dùng 2 giờ thì Pro còn 18 giờ).

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                                       |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-15 | Spec | Mở hồ sơ. Chủ sản phẩm chọn VietQR qua PayOS cho W2-01 (thay Paddle/Lemon Squeezy, mã nâng gói và trang admin). Trả trước theo kỳ vì VietQR không trừ tiền định kỳ. |

| 2026-11-15 | Spec | MoMo: đợt này không tích hợp cổng MoMo Business (cần merchant, thêm phí, desktop vẫn quét QR); người dùng MoMo quét VietQR. Module thanh toán có cổng nhà cung cấp để thêm MoMo ở W2-03b nếu số liệu beta cần. |
| 2026-11-15 | Spec | **Duyệt spec** theo đề xuất: Q2 giá Pro 99k/990k, Ultra 249k/2.490k; Q3 đơn hết hạn 15 phút; Q4 quy đổi phần Pro còn lại thành ngày Ultra; Q5 desktop mở trang web; Q6 giữ lượng đã dùng. Q1 (tài khoản PayOS) chưa trả lời: plan không phụ thuộc, nhưng chạy thật cần khoá PayOS. |
| 2026-11-15 | Plan | **Duyệt plan** (02-plan.md), gồm ADR 0023 và G1–G7. G1 sửa AC4: mã đơn lạ nhưng chữ ký hợp lệ thì trả 200, không đổi gì (để PayOS confirm-webhook). Q1: PayOS cho cá nhân đăng ký, định danh bằng CCCD (đã kiểm trên trang đăng ký). |
