---
title: Brief · web layout dùng chung
---

# Brief — `apps/web` dùng khung giao diện chung với desktop

> Nhánh `feat/ui-web-layout-codex` · Worktree `.worktrees/ui-web-layout-codex`

## Mục tiêu

Desktop đã dùng bộ component chung trong `packages/ui` (khung, thanh bên, trang "sắp ra mắt"…) và danh sách tính năng chung `packages/ui/src/lib/roadmap.ts`. Làm cho **web** dùng đúng bộ đó: layout trước, chi tiết từng trang sau.

Đọc trước: `packages/ui/src/components/{app-frame,sidebar-nav,coming-soon,page-header,section,segmented,kbd,logo,soon-badge,feature-icon}.tsx`, `packages/ui/src/lib/roadmap.ts`, `packages/ui/src/styles/brand.css`, và desktop làm mẫu: `apps/desktop/src/app/{AppShell,App}.tsx`.

## Việc cần làm

1. **Token thương hiệu + chế độ tối:** `apps/web/src/app/layout.tsx` import `@cuelingo/ui/brand.css` sau `globals.css`; thêm client component nhỏ đặt class `dark` trên `<html>` theo `prefers-color-scheme` (giống `apps/desktop/src/app/use-color-scheme.ts`).
2. **Khung đăng nhập rồi:** thay `AppShell` trong `features/auth/AppShell.tsx` bằng `AppFrame` + `SidebarNav` của `@cuelingo/ui`. `renderItem` trả `next/link` `<Link href={feature.webPath}>`; `activeId` suy ra từ `usePathname()` (feature có `webPath` là tiền tố của đường dẫn). Brand = `Logo` + tên "CueLingo". Chân thanh bên: email người dùng + nút "Đăng xuất" (giữ logic hiện có). Giữ nguyên việc chuyển hướng `/login` khi chưa có phiên.
3. **Responsive:** dưới `md` thanh bên ẩn, thay bằng thanh trên cùng (logo + nút menu mở danh sách điều hướng dạng ngăn kéo/dropdown, có `aria-expanded`, đóng khi chọn mục). Làm phần này **trong `AppFrame`/`SidebarNav` của `packages/ui`** bằng lớp Tailwind và một client hook nhỏ, để desktop không đổi (desktop có `dragRegion` và luôn rộng). Mọi đích bấm ≥ 44 px.
4. **Mọi mục của lộ trình có một route** trong `apps/web/src/app/(app)/`: `sessions`, `review`, `phrases`, `progress`, `glossary` đã có (giữ chạy). Thêm `live` (Phiên họp: `ComingSoon` với `feature` từ roadmap, action là hướng dẫn "Phiên họp trực tiếp chạy trong app macOS CueLingo") và `settings` (Cài đặt: email tài khoản, nút đăng xuất, và mục "Đang trên lộ trình" dùng `upcoming` + `SoonBadge` + `ListCard`, đúng như trang Cài đặt của desktop). Trong `roadmap.ts` đổi `webPath` của `home` thành `/live`. Mục nào `status.web === 'soon'` thì dùng `ComingSoon`.
5. **Tiêu đề trang thống nhất:** mỗi trang dùng `PageHeader`; nhóm nội dung dùng `Section`. Chỉ đổi lớp vỏ (tiêu đề, khoảng cách, thẻ), **không đổi logic/dữ liệu** của các trang hiện có; cập nhật test nếu text bị đổi.
6. Trang `/login` giữ nền phẳng canh giữa, dùng `Logo` và token mới; không dùng khung `AppFrame`.

## AC

| #   | AC (EARS)                                                                                                                                             | Test           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| AC1 | WHEN đã đăng nhập THE SYSTEM SHALL hiện thanh bên cố định (không cuộn) với 3 nhóm Họp/Học/Ứng dụng, mục hiện tại được nhấn, và chỉ phần nội dung cuộn | component test |
| AC2 | Mỗi mục `status.web === 'soon'` có chấm "sắp ra mắt" và mở trang `ComingSoon`                                                                         | component test |
| AC3 | WHEN viewport < 768px THE SYSTEM SHALL thay thanh bên bằng thanh trên cùng có nút menu hoạt động bằng bàn phím                                        | component test |
| AC4 | `/live` và `/settings` tồn tại; `/settings` có nút đăng xuất                                                                                          | component test |
| AC5 | Trang `/login` không có thanh bên                                                                                                                     | test           |
| AC6 | `pnpm verify` và `pnpm --filter @cuelingo/web build` xanh; `pnpm --filter @cuelingo/desktop exec tsc --noEmit` và test desktop vẫn xanh               | build          |

## Phạm vi file

Được sửa/tạo: `apps/web/**`, `packages/ui/src/components/{app-frame,sidebar-nav}.tsx` (+ một hook mới nếu cần), `packages/ui/src/lib/roadmap.ts` (chỉ `webPath` của `home`). Không sửa `apps/desktop/**`, `services/**`, `packages/shared/**`, `package.json`, lockfile.

Quy tắc chung: đọc `AGENTS.md` gốc và của thư mục bạn sửa. Không có mạng, không `pnpm add`, không commit/push. Chạy `pnpm verify` trước khi báo; điền mục Kết quả.

## Kết quả _(implementer điền)_

- Web đã dùng `AppFrame` + `SidebarNav` chung với desktop, có active route, ba nhóm lộ trình,
  trạng thái sắp ra mắt, email và hành động đăng xuất.
- `AppFrame` giữ nguyên chế độ desktop khi có `dragRegion`; trên web dưới `md` dùng top bar +
  drawer, nút native có `aria-expanded`, đóng khi chọn route và mọi đích điều hướng cao tối thiểu
  44 px.
- Đã import brand token, đồng bộ dark mode theo `prefers-color-scheme`, thêm `/live`, `/settings`,
  chuẩn hoá `PageHeader`/`Section` cho các trang hiện có và giữ `/login` ngoài app frame.
- Đã thêm component test cho app shell, mobile trigger, trạng thái coming-soon, hai trang mới và
  login không có điều hướng ứng dụng.

| Kiểm tra                                                   | Kết quả                                             |
| ---------------------------------------------------------- | --------------------------------------------------- |
| `pnpm verify`                                              | Xanh — 51 file test, 221 test                       |
| `pnpm --filter @cuelingo/web build`                        | Xanh — có route `/live` và `/settings`              |
| `pnpm --filter @cuelingo/desktop exec tsc --noEmit`        | Xanh                                                |
| `pnpm exec vitest run apps/desktop`                        | Xanh — 9 file test, 37 test                         |
| `pnpm --filter @cuelingo/web dev`                          | Không chạy được: sandbox chặn bind port với `EPERM` |
| `next dev --hostname 127.0.0.1 --port 3000` (thử thay thế) | Không chạy được: sandbox chặn bind port với `EPERM` |

Lưu ý môi trường: mọi lệnh pnpm in cảnh báo Node `22.14.0` thấp hơn mức repo yêu cầu `>=22.19`,
nhưng các bước verify, build và test trên đều hoàn tất thành công. Do sandbox chặn port, chưa thể
thực hiện kiểm tra trực quan trong trình duyệt ở worktree này.
