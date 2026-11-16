---
title: Khu Quản trị
---

# Khu Quản trị

> Code: `apps/web/src/features/admin/`, `apps/web/src/features/admin-nav/` (phần nhẹ cho thanh bên, tách ra để `AppShell` không kéo Recharts), `apps/web/src/app/(app)/admin/` · Spec: `06-delivery/2026-11-16-admin-console`

Nhóm **Quản trị** trong thanh bên chính và các trang thống kê cho admin. Chỉ có trên web; desktop dùng chung thanh bên thu gọn được nhưng không có nhóm này (Q1).

## Trách nhiệm

- Cho chủ sản phẩm xem tình hình người dùng, gói, doanh thu, lượng dùng và hoạt động app, chỉ từ dữ liệu đã có.
- Che sự tồn tại của khu này với người không phải admin.

## Phạm vi MVP

| Mục trong thanh bên | Route               | Trang                               | API                    |
| ------------------- | ------------------- | ----------------------------------- | ---------------------- |
| Tổng quan           | `/admin`            | `AdminOverviewPage`                 | `analytics.overview`   |
| Người dùng & gói    | `/admin/users[/id]` | [admin-users](./admin-users.md)     | `dashboard`, `users.*` |
| Doanh thu           | `/admin/revenue`    | `AdminRevenuePage`                  | `analytics.revenue`    |
| Lượng dùng          | `/admin/usage`      | `AdminUsagePage`                    | `analytics.usage`      |
| Hoạt động app       | `/admin/metrics`    | [admin-metrics](./admin-metrics.md) | `analytics.activity`   |
| Trợ lý AI           | `/admin/agent`      | [admin-agent](./admin-agent.md)     | `agent.*`              |
| Mã mời              | `/admin/invites`    | [admin-invites](./admin-invites.md) | `invites.*`            |

- **Nhóm trong thanh bên:** `ADMIN_GROUP` ở `features/admin-nav/admin-nav.ts`, truyền cho `SidebarNav` qua `extraGroups` ([ui](../05-packages/ui.md#thanh-bên-chia-nhóm-thu-gọn-được)). `AppShell` chỉ truyền khi `useIsAdmin` trả `true`: gọi `GET /v1/admin/me` (TanStack Query, `staleTime` 5 phút, không `retry`, không lưu `localStorage`). Chưa trả lời, lỗi, hoặc `false` thì nhóm không render.
- **Mục đang mở:** `adminActiveId(pathname)`: `/admin` chỉ khớp chính nó; các mục khác khớp chính nó và trang con (`/admin/users/<id>` thuộc Người dùng & gói).
- **Khung:** mọi trang `app/(app)/admin/**` nằm trong route group `(app)` nên `AppShell` + `AppFrame` bọc sẵn (URL không đổi). `AppShell` bật `wide` khi đường dẫn bắt đầu bằng `/admin`. `AdminFrame` và `AdminNav` đã bỏ; trang admin không render `<main>`.
- **Hai lớp chặn:** nhóm bị ẩn (`/admin/me`), và mỗi trang bị `401/403` thì gọi `notFound()` (người thường mở thẳng URL thấy `404` ngay trong khung app, không có nhóm Quản trị).
- **Mỗi trang thống kê** dùng `AnalyticsFrame`: trạng thái đang tải và lỗi, dòng "Cập nhật lúc … · Số liệu làm mới mỗi phút" lấy từ `generatedAt`, nút **Tải lại** (`refetch`; API cache 60 giây nên trong khoảng đó trả cùng số liệu). Chỉ số thiếu dữ liệu (tỉ lệ, trung vị có mẫu số 0) hiện "Chưa đủ dữ liệu", không phải 0.
- **Biểu đồ và thẻ số liệu** là component chung của `@cuelingo/ui` (`LineChartCard`, `BarChartCard`, `StatCard`), mỗi biểu đồ kèm bảng ẩn cho trình đọc màn hình.
- Trang Lượng dùng link tới `/admin/users?metric=…&atLeast=80|100`; ô "Không áp dụng" khi gói đó không giới hạn hoặc hạn mức bằng 0.

## Phụ thuộc

- `client.admin` của core-sdk (`access`, `analytics`, `dashboard`, `users`), [admin-analytics (API)](../03-api/admin-analytics.md), `@cuelingo/ui`.

## Dữ liệu & sự kiện

- Không lưu dữ liệu. Bốn trang thống kê chỉ hiện số tổng; chỉ trang Người dùng & gói hiện email.

## Test

`AppShell.test.tsx` (nhóm Quản trị: không hiện khi chưa trả lời hoặc `false`, đúng 7 mục và thứ tự, mục đang mở, `wide`), `AdminPages.test.tsx` (nội dung 4 trang, "Chưa đủ dữ liệu", giờ tính và nút tải lại, không còn `AdminFrame`/`AdminNav`, route nằm trong `(app)`, bộ lọc từ URL).

## Câu hỏi mở

- Thống kê theo nền tảng và phiên bản app: để đợt sau (cần migration và header từ app).
