---
title: Admin người dùng và gói
---

# Admin người dùng và gói (admin-users)

> Phần: [API service](./README.md) · Code: `services/api/src/modules/admin-users/` · Spec: `06-delivery/2026-11-15-admin-users-plans`

Cho chủ sản phẩm xem ai đang ở gói nào, doanh thu tháng, gói sắp hết hạn, và đổi gói theo người. Màn hình: [admin-users (web)](../02-web/admin-users.md).

## Trách nhiệm

- Bốn route chỉ dành cho `ADMIN_EMAILS`. Mỗi route hỏi `admin.service.isAdmin` **trước mọi thứ**: người không phải admin luôn nhận `403`, kể cả với id không tồn tại hay query sai (không bao giờ `400`/`404` trước).
- Đọc xuyên người dùng: bảng `auth_user`, `user_plans`, `usage_counters`, `billing_orders` (chỉ tổng tiền) và `sessions` (chỉ `max(started_at)`, bỏ phiên `deleted`). Không đọc tiêu đề phiên, transcript, cụm từ.
- Không tự ghi `user_plans`: đổi gói đi qua `usage.service.setPlanFor`; lượng dùng qua `usage.service.snapshot`; đơn qua `billing.service.listOrders`. Module được dựng sau `usage` và `billing` trong `app.ts`.
- Không có bảng mới, không migration.

## Interface

| Method | Path                       | Kết quả                                                                                                                            |
| ------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/admin/dashboard`      | `AdminDashboardSchema`: `totalUsers`, `byPlan{free,pro,ultra}`, `newUsers7d`, `revenueThisMonth` (VND), `expiringIn7d`             |
| GET    | `/v1/admin/users`          | Query `AdminUserListQuerySchema` `{q?, plan?, expiring?: '1', cursor?}` → `AdminUserListSchema` `{items[], nextCursor}`; 50 dòng   |
| GET    | `/v1/admin/users/:id`      | `AdminUserDetailSchema` `{user, usage, orders[]}`; `404` nếu không có người này                                                    |
| PUT    | `/v1/admin/users/:id/plan` | Body `AdminSetUserPlanRequestSchema` `{plan, expiresAt?}` → `{plan, source:'manual', expiresAt \| null}`; `400` `expiresAt` đã qua |

Câu trả lời đi qua schema strict ở route, nên thêm nhầm một trường (nội dung họp, link thanh toán) sẽ lỗi chứ không lọt ra ngoài. `PUT` cần có trong CORS của `app.ts` vì web gọi khác origin.

## Quy tắc

| Chủ đề        | Quy tắc                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gói đang dùng | `plan` = gói đang hiệu lực: không có dòng, hoặc dòng đã qua `expires_at`, là `free`. `source` và `expiresAt` là của dòng đã lưu, nên gói hết hạn hiện `plan:'free'` kèm ngày cũ. Cùng biểu thức với `effectivePlanSql` của `usage`                                                                                                                                                                                                                                    |
| Dashboard     | Pro/Ultra chỉ đếm khi còn hạn; Free = tổng − Pro − Ultra. Doanh thu = tổng `amount` đơn `paid` có `paid_at` trong tháng dương lịch giờ VN (`periodStart('translation_ms')`); gói gán tay không phải doanh thu. Sắp hết hạn: `(now, now+7 ngày]`, cả gói mua lẫn gán tay                                                                                                                                                                                               |
| Danh sách     | Keyset theo `("createdAt" DESC, id DESC)`, cursor mờ (base64url của thời điểm theo text của Postgres, giữ micro giây, và id). Cursor hỏng → `400` `VALIDATION_ERROR`, kể cả khi đúng khuôn nhưng không có thời điểm đó (ngày 30/02, giờ 25, năm 0000): thời điểm phải đi vòng qua `toISOString()` và khớp đến giây, vì Postgres sẽ báo lỗi (500) nếu nhận nó. Một câu SQL: CTE lấy trang (≤ 51 dòng), rồi join lượng dùng và `max(started_at)` chỉ cho id trong trang |
| Tìm kiếm      | `ILIKE '%q%'` trên email và tên; `\`, `%`, `_` được escape nên gõ `%` không khớp mọi dòng; `q` ≤ 100 ký tự; không có index (thêm `pg_trgm` khi quá khoảng 10 nghìn người)                                                                                                                                                                                                                                                                                             |
| Đổi gói       | Admin lấy từ phiên, người bị đổi từ đường dẫn. `source='manual'`, `set_by` = admin. Chọn Free thì bỏ hạn. Hạ gói người đã trả tiền vẫn được (hoàn tiền tay ngoài hệ thống); cảnh báo là việc của UI                                                                                                                                                                                                                                                                   |
| Nhật ký       | Một dòng `plan changed` do `usage.setPlanFor` ghi: `adminId`, `targetUserId`, `from`, `to`. Không có email. Không có bảng lịch sử                                                                                                                                                                                                                                                                                                                                     |

## Giới hạn hiệu năng đã biết

Cột "hoạt động gần nhất" chạy `max(started_at)` trên `sessions` cho từng id của trang (≤ 50 người), mà `sessions` **chưa có index trên `user_id`**, nên mỗi lần mở trang quét bảng `sessions` tới 50 lần (theo `user_id`). Chấp nhận được ở quy mô beta; chậm dần khi `sessions` lớn lên. Không thêm migration trong task này (đổi schema cần chủ sản phẩm duyệt).

Việc tiếp theo, làm bằng một migration mới (không sửa file cũ):

```sql
CREATE INDEX sessions_user_started_idx ON sessions (user_id, started_at DESC);
```

Khi nào làm: trang `/admin/users` mất trên khoảng 1 giây, hoặc `sessions` vượt vài trăm nghìn dòng. Index này cũng giúp các truy vấn khác lọc theo người dùng (danh sách phiên của chính họ).

## Quyền riêng tư

Đây là chỗ **duy nhất** admin thấy email và tên của mọi người dùng (Q1 của spec); [Số liệu nội bộ](../02-web/admin-metrics.md) vẫn không có định danh. Xem hàng "Admin vận hành" ở [bảo mật & riêng tư](../../03-architecture/08-security-privacy.md). Giảm thiểu: chỉ `ADMIN_EMAILS`, mỗi trang 50 dòng, không xuất CSV, log không chứa email.

## Test

`admin-users.test.ts` (4 route trả 403 cho người thường, kể cả id lạ; dashboard và ranh tháng; danh sách, phân trang, tìm kiếm, lọc; chi tiết không có QR; đổi gói; nhật ký), `test/integration/admin-users.int.test.ts` (SQL thật: ranh tháng VN, keyset, escape `ILIKE`, gói hết hạn là free, bỏ phiên `deleted`).
