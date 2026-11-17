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
- Trang chi tiết `/admin/users/<id>` và đổi gói: xem phần "Chi tiết và đổi gói".

## Interface

| Thành phần                             | Nội dung                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AdminUsersPage`                       | Container: hai query (`client.admin.dashboard`, `client.admin.users.list`), gọi `notFound()` khi một trong hai trả `401/403`                                                                                                                                                                                                                                                                  |
| `AdminDashboardView`, `AdminUserTable` | Thuần, nhận dữ liệu qua props (test bằng `renderToStaticMarkup`). `AdminDashboardView` nhận `dashboard: AdminDashboard \| null`: khi dashboard đang tải hoặc lỗi, các thẻ nhóm người (Tổng, Free, Pro, Ultra, sắp hết hạn) vẫn hiện và vẫn lọc được, chỉ không có số. Thẻ lọc là `FilterCard` chung. Thanh đo ở từng hàng dùng `DEFAULT_PLAN_LIMITS` vì DTO của hàng không mang hạn mức riêng |
| `use-admin-users.ts`                   | `useAdminDashboard`, `useAdminUsers(filters)` (khoá cache theo bộ lọc), `queryFor` (chỉ gửi tham số có giá trị), `useDebounced`                                                                                                                                                                                                                                                               |
| `admin-users-format.ts`                | `sourceLabel` (Gán tay / Thanh toán), `expiryText`: gói đã hết hạn hiện `Free` kèm "Hết hạn dd/mm/yyyy" để phân biệt với tài khoản Free chưa từng trả                                                                                                                                                                                                                                         |

Cột: email (liên kết tới chi tiết) và tên, ngày đăng ký, gói, nguồn, hết hạn, giờ dịch tháng này, hoạt động gần nhất (phiên họp gần nhất, "Chưa có" nếu chưa họp).

## Phụ thuộc

- `client.admin` của web gộp khoá của core-sdk (`dashboard`, `users`) với các lời gọi chỉ web có (`metrics`, `agent`, `invites`). Khoá `admin` của web không được đè khoá của core-sdk; `lib/client.test.ts` giữ điều đó.
- Nằm trong khung app chung, mục **Người dùng & gói** của nhóm Quản trị ([Khu Quản trị](./admin-console.md)).
- **Bộ lọc hạn mức từ URL:** `/admin/users?metric=debriefs&atLeast=80` (link từ trang Lượng dùng) đặt bộ lọc ban đầu, hiện thành một nhãn có nút `×` để bỏ; gửi `metric` và `atLeast` tới `GET /v1/admin/users`. Cặp không hợp lệ thì bỏ qua. Trang bọc `useSearchParams` trong `Suspense` cho bản tĩnh.
- Bảng, thẻ số liệu, `Segmented`, `Input`, `formatVnd`, `formatDateVn`, `planName` đều có sẵn ở `@cuelingo/ui`; admin chỉ có trên web nên khung admin nằm ở `apps/web`.

## Dữ liệu & quyền riêng tư

- Không lưu gì ở client ngoài cache của React Query. Có email và tên của người khác: xem [bảo mật & riêng tư](../../03-architecture/08-security-privacy.md#admin-xem-danh-sách-người-dùng).
- Không hiện tiêu đề phiên, transcript, cụm từ, mã QR hay link thanh toán.

## Chi tiết và đổi gói

Route `/admin/users/<id>` là một trang giữ chỗ `_` (như `/sessions/<id>`): `generateStaticParams`, một dòng `/admin/users/*  /admin/users/_  200` trong `public/_redirects`, id đọc bằng `useRouteId('/admin/users')`. Dấu `*` chỉ khớp khi có `/…` phía sau nên `/admin/users` vẫn là trang danh sách.

| Thành phần            | Nội dung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AdminUserDetailView` | Email, tên, ngày đăng ký; nguồn và hạn gói; `UsageSummary` của `@cuelingo/ui` (5 hạn mức như `/v1/me/usage`); form đổi gói; `AdminOrderList` (gói, kỳ, số tiền, trạng thái, ngày; không QR, không link)                                                                                                                                                                                                                                                                                 |
| `PlanForm`            | Chọn Free/Pro/Ultra, và với Pro/Ultra chọn thời hạn 1 tháng (mặc định) hoặc 1 năm; không còn ô ngày. Hiện "Hết hạn (dự kiến): dd/mm/yyyy" tính ở client bằng đúng hàm `planAfterAdminGrant` của `@cuelingo/shared` (`previewExpiresAt`) với giá mặc định: chỉ khác server khi Pro→Ultra và `PLAN_PRICES` đổi tỉ lệ giá tháng, nên ghi "dự kiến"; ngày chính xác do server trả về và hiện sau khi lưu. Gửi `{plan, period}` (Free chỉ `{plan}`). Bấm Lưu mở hộp xác nhận, không lưu ngay |
| `PlanChangeConfirm`   | `ConfirmDialog` hỏi "Đổi gói?" (nút Huỷ được focus trước), nêu gói, kỳ, ngày hết hạn dự kiến và rằng hệ thống ghi một đơn 0đ "Admin tặng". Khi hạ một gói **thanh toán** còn hạn, thêm dòng "Người này đã trả tiền đến dd/mm/yyyy" (`planChangeWarning`)                                                                                                                                                                                                                                |
| `use-admin-user.ts`   | `GET` chi tiết; `PUT` đổi gói rồi làm mới danh sách, chi tiết và dashboard. `401/403` → `notFound()`; `404` → "Không tìm thấy người dùng này"                                                                                                                                                                                                                                                                                                                                           |

Cảnh báo chỉ cho việc **hạ hạng** gói đã trả (Ultra → Pro, → Free); lên hạng, cùng hạng, gói gán tay hoặc gói đã hết hạn thì không cảnh báo. Vẫn cho làm: hoàn tiền (nếu cần) làm tay ngoài hệ thống.

Test: `AdminUsersPage.test.tsx`, `AdminUserDetail.test.tsx`, `lib/client.test.ts`.

## Giao diện mới (UI redesign, AC15 và AC16)

Các ô thống kê Tổng, Free, Pro, Ultra và Sắp hết hạn là nút lọc (`aria-pressed`, viền đậm khi đang chọn) và đồng bộ với bộ lọc của danh sách; ô Đăng ký mới và Doanh thu là số thuần. Mỗi dòng có `UsageMeter` giờ dịch tháng này so với hạn mức mặc định của gói (`DEFAULT_PLAN_LIMITS`; bảng chỉ có số giờ dịch, hạn mức do `PLAN_LIMITS` ghi đè chỉ hiện đúng ở trang chi tiết). Hộp xác nhận đổi gói nêu gói cũ → gói mới, ngày hết hạn dự kiến, đơn 0đ "Admin tặng" và cảnh báo khi hạ gói đã trả tiền; focus bắt đầu ở Huỷ.
