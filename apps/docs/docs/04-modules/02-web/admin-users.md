---
title: Admin · người dùng và gói
---

# Admin · người dùng và gói

> Code: `apps/web/src/features/admin/AdminUsersPage.tsx`, route `/admin/users` · API: [admin-users](../03-api/admin-users.md) · Hồ sơ: `06-delivery/2026-11-15-admin-users-plans`

Trang cho admin (`ADMIN_EMAILS`) xem ai đang ở gói nào, doanh thu và gói sắp hết hạn. Người không phải admin nhận `404` như `/admin/metrics`.

## Trách nhiệm

- Dashboard: tổng người dùng, số người theo gói Free/Pro/Ultra (chỉ gói còn hạn), đăng ký mới 7 ngày, doanh thu tháng này (VND), số gói trả phí hết hạn trong 7 ngày tới.
- Danh sách người dùng, mới đăng ký trước, 50 dòng một lần, nút "Xem thêm" (`useInfiniteQuery`, cursor của API).
- Ô tìm theo email hoặc tên (chờ 300 ms sau khi ngừng gõ rồi mới gửi) và một nút chọn lọc: Tất cả · Free · Pro · Ultra · Sắp hết hạn.
- Trang chi tiết một người và đổi gói: xem phần cuối trang này.

## Interface

| Thành phần                             | Nội dung                                                                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AdminUsersPage`                       | Container: hai query (`client.admin.dashboard`, `client.admin.users.list`), gọi `notFound()` khi một trong hai trả `401/403`                          |
| `AdminDashboardView`, `AdminUserTable` | Thuần, nhận dữ liệu qua props (test bằng `renderToStaticMarkup`)                                                                                      |
| `use-admin-users.ts`                   | `useAdminDashboard`, `useAdminUsers(filters)` (khoá cache theo bộ lọc), `queryFor` (chỉ gửi tham số có giá trị), `useDebounced`                       |
| `admin-users-format.ts`                | `sourceLabel` (Gán tay / Thanh toán), `expiryText`: gói đã hết hạn hiện `Free` kèm "Hết hạn dd/mm/yyyy" để phân biệt với tài khoản Free chưa từng trả |

Cột: email (liên kết tới chi tiết) và tên, ngày đăng ký, gói, nguồn, hết hạn, giờ dịch tháng này, hoạt động gần nhất (phiên họp gần nhất, "Chưa có" nếu chưa họp).

## Phụ thuộc

- `client.admin` của web gộp khoá của core-sdk (`dashboard`, `users`) với các lời gọi chỉ web có (`metrics`, `agent`, `invites`). Khoá `admin` của web không được đè khoá của core-sdk; `lib/client.test.ts` giữ điều đó.
- Khung `AdminFrame`/`AdminNav` (xem [Số liệu nội bộ](./admin-metrics.md)); thanh liên kết chỉ hiện khi một trong hai lời gọi đã trả thành công.
- Bảng, thẻ số liệu, `Segmented`, `Input`, `formatVnd`, `formatDateVn`, `planName` đều có sẵn ở `@cuelingo/ui`; admin chỉ có trên web nên khung admin nằm ở `apps/web`.

## Dữ liệu & quyền riêng tư

- Không lưu gì ở client ngoài cache của React Query. Có email và tên của người khác: xem [bảo mật & riêng tư](../../03-architecture/08-security-privacy.md#admin-xem-danh-sách-người-dùng).
- Không hiện tiêu đề phiên, transcript, cụm từ, mã QR hay link thanh toán.
