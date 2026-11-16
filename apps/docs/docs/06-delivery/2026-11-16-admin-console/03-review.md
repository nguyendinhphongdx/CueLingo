# Review — admin-console

Nhánh `feat/admin-console` (xếp chồng trên `feat/w2-03-vietqr-upgrade` 303a3ec; merge sau W2-03). Chưa push, chưa merge.

## Đã làm (theo AC)

| AC    | Làm gì                                                                                                 | Kiểm bằng                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| AC1   | `SidebarNav`: nút tiêu đề mỗi nhóm, `aria-expanded`, `aria-controls`, danh sách `hidden` khi thu gọn   | `sidebar-nav.test.tsx` (web và desktop); xem tay trên web                                       |
| AC2   | `useCollapsedGroups`, khoá `cuelingo.sidebar.collapsed.v1`, `try/catch`; nhóm chứa trang đang mở tự mở | `sidebar-nav.test.tsx` › persist; xem tay: thu gọn Học rồi tải lại vẫn thu gọn                  |
| AC3   | `extraGroups` + `ADMIN_GROUP` (7 mục), `GET /v1/admin/me`, `useIsAdmin` (bộ nhớ, `staleTime` 5 phút)   | `AppShell.test.tsx`, `admin.test.ts`; xem tay với admin và người thường                         |
| AC4   | `requireAdmin` trước cache ở cả 4 route; `404` ở trang qua `notFound()`                                | `admin-analytics.test.ts` › forbidden; xem tay: người thường mở `/admin/revenue` thấy 404       |
| AC5–8 | 4 endpoint `GET /v1/admin/analytics/*`, SQL ở `admin-analytics.repository.ts`, 4 trang web             | `admin-analytics.test.ts`, `admin-analytics.int.test.ts` (Postgres thật), `AdminPages.test.tsx` |
| AC9   | Schema strict, không có trường định danh, không route ghi                                              | `admin-analytics.test.ts` › no identifiers                                                      |
| AC10  | `StatCard` `null` → "Chưa đủ dữ liệu"; `AnalyticsFrame` có giờ tính và nút Tải lại                     | `stat-card.test.tsx`, `chart-card.test.tsx`, `AdminPages.test.tsx`                              |
| AC11  | `app/admin` → `app/(app)/admin`, `AdminFrame`/`AdminNav` bỏ, `AppFrame` có `wide`                      | `AdminPages.test.tsx` (cấu trúc); xem tay                                                       |
| Q-lọc | `metric` + `atLeast` ở `GET /v1/admin/users`, link từ trang Lượng dùng, nhãn bộ lọc ở trang người dùng | `admin-users.test.ts` › quota filter, `admin-users.int.test.ts`                                 |

## Chạy thật

| Việc                                                                                        | Kết quả                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify` (Node 22.14)                                                                  | Xanh: format, lint, typecheck, 245 file test (1993 test), `check:deps`                                                                                                           |
| `pnpm test:int` (Postgres thật qua Docker, Node 25.6 vì Node 22.14 lỗi undici trong vitest) | Xanh: 23 file, 95 test, gồm `admin-analytics.int.test.ts` (6) và bộ lọc hạn mức trong `admin-users.int`                                                                          |
| `pnpm docs:build`                                                                           | Xanh, không link hỏng                                                                                                                                                            |
| `pnpm --filter @cuelingo/web build:static`                                                  | Xanh. Recharts (~410 KB) chỉ nằm trong chunk của các trang `/admin*`; chunk của `/sessions` và `/login` không chứa nó                                                            |
| Web chạy thật trên `next dev` với trình duyệt                                               | Có, nhưng với **API giả** (mock) trả số liệu mẫu: thấy nhóm Quản trị, biểu đồ, thu gọn Học và giữ sau tải lại, `/admin/usage`, và người thường nhận `404` không có nhóm Quản trị |

## Chưa chạy / chưa kiểm

- **Chưa chạy web với API thật** (Postgres + Better Auth + tài khoản admin trong `ADMIN_EMAILS`). SQL đã kiểm bằng int test trên Postgres thật, UI kiểm với API giả; ghép hai đầu thì chưa. Việc nên làm trước khi merge: đăng nhập thật bằng tài khoản admin và tài khoản thường.
- **Chưa mở desktop.** Desktop không sửa code, `tsc` của desktop và test của nó xanh, `renderItem` giữ chữ ký tương thích (method), nhưng chưa nhìn nhóm thu gọn trong app Tauri.
- **Chưa so kích thước chunk trước và sau** bằng số đo ở nhánh gốc; chỉ xác nhận Recharts không lọt vào chunk của trang ngoài `/admin*`.
- **Chưa thử viewport hẹp** (menu mobile) bằng mắt; test chỉ kiểm nút và tiêu đề nhóm vẫn render trong ngăn kéo.
- `EXPLAIN ANALYZE` chưa đo (plan ghi ở mục Rủi ro). Index đề xuất vẫn là việc sau.
- Chưa có chạy có `dark`/`light` song song; chỉ xem giao diện tối.

## Lệch so với plan

- Thêm feature web `admin-nav` (nhóm Quản trị, `adminActiveId`, `useIsAdmin`) thay vì để trong `features/admin`: luật `web-features-via-index` (check:deps) không cho `AppShell` import file con của `features/admin`, và import qua index của nó sẽ kéo Recharts vào mọi trang đã đăng nhập.
- `AdminUsersOptions` nhận `limits` và `app.ts` tính `planLimits` một lần (thay cho hai lần `resolvePlanLimits()`), như bước 3 của plan.
- `nav` của `SidebarNav` thêm `overflow-y-auto` để danh sách dài (thêm nhóm Quản trị) cuộn được trong khung 220px; plan không nhắc.
- Màu biểu đồ thêm hai token `--chart-1`, `--chart-2` trong `globals.css` (sáng và tối) vì luật không cho màu cứng.

## Việc còn lại / đề xuất sau

- Người thường mở URL `/admin/*` tạo 2 request `403` trên console (`retry: 1` của `providers.tsx`); không lộ dữ liệu, nhưng ồn. Có thể đặt `retry: false` cho các hook admin.
- Nhóm Học gọn lại: do session khác làm ở `roadmap.ts`, ngoài phạm vi.
- Thống kê theo nền tảng và phiên bản app (Q4): cần migration.
