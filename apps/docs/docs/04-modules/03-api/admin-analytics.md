---
title: Admin thống kê
---

# Admin thống kê (admin-analytics)

> Phần: [API service](./README.md) · Code: `services/api/src/modules/admin-analytics/` · Spec: `06-delivery/2026-11-16-admin-console`

Số liệu tổng hợp cho các trang Tổng quan, Doanh thu, Lượng dùng và Hoạt động app của khu Quản trị (trang web `admin-console`). Chỉ đọc, chỉ số tổng, không có định danh.

## Trách nhiệm

- Bốn route `GET`, chỉ cho `ADMIN_EMAILS`. Service hỏi `admin.service.isAdmin` **trước cả cache**: người thường nhận `403` kể cả khi cache đã có dữ liệu; chưa đăng nhập nhận `401`.
- Không route ghi nào. Không migration: chỉ đọc `auth_user`, `user_plans`, `sessions`, `review_logs`, `billing_orders`, `usage_counters`, và cột `cost_usd` của `events` (không đọc `payload`).
- Câu trả lời đi qua schema strict của `@cuelingo/shared` (`admin-analytics.dto.ts`), nên một trường định danh lọt vào sẽ lỗi to thay vì rò ra.

## Interface

| Method | Path                           | Kết quả                                                                                                                                                          |
| ------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/admin/analytics/overview` | `AdminOverview`: dashboard của [admin-users](./admin-users.md) cộng người mới 7/30 ngày, người hoạt động 1/7/30 ngày, chuỗi 30 ngày (người mới, người hoạt động) |
| GET    | `/v1/admin/analytics/revenue`  | `AdminRevenue`: doanh thu ngày (30) và tháng (12), theo gói và kỳ (4 tổ hợp), đơn theo trạng thái, `paidRate` (`null` khi 0 đơn), `adminGrants`                  |
| GET    | `/v1/admin/analytics/usage`    | `AdminUsage`: từng hạn mức (`total`, `averageByPlan`, `atLeast80`, `atLeast100`) và `aiCostUsdThisMonth`                                                         |
| GET    | `/v1/admin/analytics/activity` | `AdminActivity`: `metrics` (đúng `GET /v1/admin/metrics`), cuộc họp và giờ họp theo ngày (30), `meetingUsers` (DAU/WAU/MAU)                                      |

## Quy tắc

- **Cache 60 giây** trong tiến trình, một mục cho mỗi route, dùng chung mọi admin (số liệu không phụ thuộc người gọi). Mục lưu promise, nên request đồng thời chỉ chạy SQL một lần; lỗi thì xoá mục. Nút "Tải lại" không bỏ qua cache. `cacheMs` và `now` truyền được khi test.
- **Giờ VN:** ngày và tháng lịch tính theo `Asia/Ho_Chi_Minh`; cửa sổ N ngày trượt từ lúc gọi.
- **Người hoạt động** = có ít nhất một phiên họp (không `deleted`) hoặc một lượt ôn trong khoảng. DAU/WAU/MAU của `activity` chỉ tính phiên họp. Định nghĩa: [Quan sát hệ thống](../../05-engineering/observability.md#định-nghĩa-số-liệu).
- **Doanh thu** chỉ tính đơn `paid` không phải của admin. Đơn tặng gói (0đ, `provider='admin'`) chỉ vào `adminGrants`. `paidRate` = `paid` / mọi đơn đã tạo trong 30 ngày, trừ đơn admin.
- **Gói còn hạn:** `lib/plan-sql.ts` giữ biểu thức SQL và bảng hạn mức dùng chung (hạn mức lấy từ env `PLAN_LIMITS`). Gói hết hạn tính là Free. Hạn mức `null` hoặc 0 thì `atLeast80`/`atLeast100` không áp dụng (`null`); trung bình theo gói là `null` khi gói không có ai.
- `atLeast80` gồm cả người đã ≥ 100%. Link sang danh sách đã lọc dùng `metric` + `atLeast` của [admin-users](./admin-users.md).

## Phụ thuộc

- `admin.service` (`isAdmin`, `metrics`), `admin-users.service` (`dashboard`), `planLimits` của `app.ts`.

## Test

- `admin-analytics.test.ts`: `403`/`401`, ghép số, không định danh, không route ghi, cache.
- `test/integration/admin-analytics.int.test.ts` (Postgres thật): ranh giới ngày và tháng giờ VN, đơn admin 0đ, phiên `deleted`, lượt ôn, ngưỡng 80/100% theo `PLAN_LIMITS` tuỳ chỉnh, gói hết hạn, chuỗi ngày đủ phần tử.

## Giới hạn hiệu năng đã biết

Các truy vấn quét `sessions`, `review_logs`, `billing_orders` vì chưa có index trên `started_at`, `at`, `paid_at`. Ở quy mô beta cùng cache 60 giây là đủ. Khi một route vượt khoảng 300 ms hoặc `sessions` vượt khoảng 1 triệu dòng, đề xuất migration `sessions(started_at)`, `review_logs(at)`, `billing_orders(paid_at) WHERE status='paid'`.
