# admin-users-plans — Trang admin: dashboard, người dùng, gói

| Trạng thái | Loại    | Nhánh / PR                         | Ước lượng → thực tế |
| ---------- | ------- | ---------------------------------- | ------------------- |
| Làm        | feature | `feat/w2-03-vietqr-upgrade` / _PR_ | M → ?               |

**Phạm vi:**

- **Trong:**
  - Trang `/admin/users` trên web: dashboard số liệu gói và doanh thu, danh sách người dùng kèm gói (subscription), trang chi tiết một người, đổi gói.
  - Các endpoint admin để đọc những dữ liệu đó.
- **Ngoài:**
  - Xoá hoặc khoá tài khoản, sửa email.
  - Hoàn tiền (vẫn hoàn tay).
  - Xem nội dung cuộc họp, transcript, Phrase Bank của người dùng.
  - Xuất CSV.
  - Phân quyền nhiều cấp admin. Vẫn dùng `ADMIN_EMAILS`.

**Phụ thuộc:** [W2-02](../2026-11-14-w2-02-plans-quota/01-specs.md) (gói, lượng dùng, `PUT /v1/admin/plan`) và [W2-03](../2026-11-15-w2-03-vietqr-upgrade/01-specs.md) (đơn thanh toán, hạn gói). Làm sau khi W2-03 xong backend.

## 1. Vấn đề

Đổi gói hiện chỉ làm được bằng gọi API trong DevTools hoặc chạy SQL, vừa dễ sai vừa không xem được ai đang ở gói nào. Chủ sản phẩm cũng không có chỗ để xem:

- bao nhiêu người đang trả phí, doanh thu tháng này là bao nhiêu;
- gói nào sắp hết hạn;
- một người cụ thể đã dùng bao nhiêu và đã trả những đơn nào.

Trang `/admin/metrics` hiện nay cố ý **không hiện định danh**. Trang mới phải hiện email để admin tìm và đổi gói đúng người. Đây là một thay đổi về quyền riêng tư: admin xem được danh sách email của mọi người dùng.

**Người bị ảnh hưởng:** chủ sản phẩm và admin. Người dùng bị ảnh hưởng gián tiếp vì admin thấy email, gói và lượng dùng của họ.

**Spec và module liên quan:**

- [Số liệu nội bộ](../../04-modules/02-web/admin-metrics.md), [Admin API](../../04-modules/03-api/admin.md), [usage](../../04-modules/03-api/usage.md)
- Module billing (W2-03), `@cuelingo/shared`, `@cuelingo/core-sdk`, `@cuelingo/ui`

## 2. Tiêu chí chấp nhận (EARS)

| #   | AC                                                                                                                                                                                                                                                                   | Test                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| AC1 | WHEN admin mở `/admin/users` THE SYSTEM SHALL hiện dashboard: tổng người dùng · số người theo gói (Free/Pro/Ultra, chỉ tính gói còn hạn) · số người đăng ký mới trong 7 ngày · doanh thu tháng này (tổng đơn `paid`, VND) · số gói trả phí hết hạn trong 7 ngày tới. | `admin-users.test.ts` › dashboard · `AdminUsersPage.test.tsx`    |
| AC2 | WHEN admin xem danh sách THE SYSTEM SHALL hiện mỗi người: email, tên, ngày đăng ký, gói hiện tại, nguồn (gán tay/thanh toán), ngày hết hạn, giờ dịch đã dùng tháng này, lần hoạt động gần nhất. Phân trang 50 dòng, mới đăng ký trước.                               | `admin-users.test.ts` › list                                     |
| AC3 | WHEN admin gõ vào ô tìm kiếm hoặc chọn bộ lọc gói THE SYSTEM SHALL lọc theo email/tên chứa chuỗi đó, theo gói, và theo "sắp hết hạn".                                                                                                                                | `admin-users.test.ts` › search · filter                          |
| AC4 | WHEN admin mở một người THE SYSTEM SHALL hiện gói và hạn, lượng dùng tháng này (5 hạn mức như `/v1/me/usage`), và lịch sử đơn thanh toán (gói, kỳ, số tiền, trạng thái, ngày). Không hiện nội dung cuộc họp.                                                         | `admin-users.test.ts` › detail                                   |
| AC5 | WHEN admin đổi gói (Free/Pro/Ultra, ngày hết hạn tuỳ chọn) và xác nhận THE SYSTEM SHALL lưu với nguồn "gán tay" và người đổi là admin, rồi cập nhật danh sách. Gói mới áp từ lượt kiểm hạn mức tiếp theo.                                                            | `admin-users.test.ts` › change plan · `AdminUserDetail.test.tsx` |
| AC6 | IF admin hạ một người đang có gói **thanh toán** còn hạn THEN THE SYSTEM SHALL hiện cảnh báo "Người này đã trả tiền đến dd/mm/yyyy" trước khi xác nhận.                                                                                                              | `AdminUserDetail.test.tsx`                                       |
| AC7 | IF người gọi không thuộc `ADMIN_EMAILS` THEN mọi endpoint admin mới trả `403`, còn trang hiện `404` như `/admin/metrics`.                                                                                                                                            | `admin-users.test.ts` › forbidden                                |
| AC8 | WHEN admin đổi gói THE SYSTEM SHALL ghi log gồm id admin, id người dùng, gói cũ, gói mới, hạn. Không ghi email vào log. Mọi endpoint chỉ đọc, ngoại trừ endpoint đổi gói.                                                                                            | `admin-users.test.ts` › audit log                                |
| AC9 | WHEN admin đang xem trang THE SYSTEM SHALL có liên kết qua lại giữa `/admin/users`, `/admin/metrics`, `/admin/invites`, `/admin/agent` (một khung admin chung).                                                                                                      | `AdminNav.test.tsx`                                              |

UI tiếng Việt. Các thành phần dùng chung, như bảng, thẻ số liệu và nhãn gói, đặt ở `@cuelingo/ui` nếu có ở hơn một client.

## 3. Câu hỏi mở

- [x] **Q1. Hiện email đầy đủ** trong danh sách admin (đề xuất: có, vì cần để hỗ trợ người dùng). Ghi vào trang security-privacy rằng chỉ admin trong `ADMIN_EMAILS` xem được.
- [x] **Q2. Hạ gói một người đã trả tiền:** chỉ cảnh báo (AC6) rồi cho làm, hoàn tiền tay ngoài hệ thống (đề xuất); hay chặn hẳn?
- [x] **Q3. "Lần hoạt động gần nhất":** lấy từ phiên họp hoặc lần gọi API gần nhất. Đề xuất: `max(sessions.started_at)`, rẻ, không cần bảng mới.
- [x] **Q4. Doanh thu:** tính theo tháng dương lịch giờ VN, chỉ đơn PayOS `paid` (đề xuất). Gói gán tay không tính là doanh thu.

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                                                                                                                     |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-15 | Spec | Mở hồ sơ theo yêu cầu "trang admin có dashboard, danh sách người dùng và subscription, đổi được loại gói". Làm sau backend W2-03 vì cần `billing_orders` và hạn gói.                                                                              |
| 2026-11-15 | Spec | **Duyệt spec** theo đề xuất: Q1 hiện email đầy đủ cho admin (ghi vào security-privacy); Q2 cảnh báo rồi cho hạ, hoàn tay; Q3 hoạt động gần nhất = phiên họp gần nhất; Q4 doanh thu = đơn paid theo tháng giờ VN. Plan sau khi backend W2-03 xong. |
| 2026-11-15 | Plan | **Duyệt plan** (02-plan.md, G1–G8). Làm trên nhánh `feat/w2-03-vietqr-upgrade` (phụ thuộc billing chưa merge), sau khi UI W2-03 commit xong để tránh hai agent cùng commit trên một cây làm việc.                                                 |
