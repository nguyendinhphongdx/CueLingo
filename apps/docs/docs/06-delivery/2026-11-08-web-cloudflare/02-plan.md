# Plan — web-cloudflare

## 1. Bối cảnh code

- `apps/web` là Next 16 (App Router), build bằng `next build --webpack`. Mọi cấu hình chạy lúc build là `NEXT_PUBLIC_*` (`API_URL`, `DOWNLOAD_URL`, `GOOGLE_ENABLED`, `SANDBOX_ORIGIN`, `AGENT_HTML_BLOCKS`). Không có middleware, server action, route handler hay đọc cookie phía máy chủ; trang phía người dùng dùng React Query và `better-auth` client gọi API.
- Hai route động: `sessions/[id]/page.tsx` và `assistant/[[...id]]/page.tsx`. Cả hai là server component đọc `await params` rồi truyền `id` vào một component client (`DebriefPage`, `AssistantPage`). `AssistantPage` còn dùng `router.replace('/assistant/<id>')`.
- CSP: `next.config.ts` đã gắn CSP cho mọi route (`source: '/:path*'`) bằng `headers()` lấy từ `src/lib/csp.ts` (`frame-src` + `img-src`). `headers()` không chạy với bản xuất tĩnh.
- Tên miền: `cuelingo.tutorial-aws.com` cho web (DNS ở Cloudflare). API sau này ở `api-cuelingo.tutorial-aws.com`, cùng site nên cookie đăng nhập (`Domain=.tutorial-aws.com`) dùng chung được; việc đó nằm ở hạng mục API.
- Workflow mẫu: `.github/workflows/pages.yml` (build, quét chuỗi nhạy cảm bằng `apps/site/scripts/scan-dist.mjs`, action ghim SHA). Lưu ý khi cài: `CI=true pnpm install` để không bị treo hỏi xác nhận.

## 2. Phương án

| #   | Phương án                                                                                                                                                               | Ưu                                                                                     | Nhược                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Xuất tĩnh (`output: 'export'`) lên Cloudflare Pages; hai route động dùng một đường dẫn giữ chỗ + `_redirects` rewrite, `id` đọc phía client; CSP chuyển sang `_headers` | Không cần runtime Node, rẻ, đơn giản, đúng với web chạy phía người dùng; nhanh nhờ CDN | Phải sửa 2 route động; mất `headers()` nên phải giữ `_headers` khớp `csp.ts`; sau này cần tính năng máy chủ thì phải đổi                        |
| B   | Chạy Next đầy đủ trên Cloudflare Workers bằng OpenNext (`@opennextjs/cloudflare`)                                                                                       | Không đổi route; `headers()` chạy nguyên; sẵn tính năng máy chủ về sau                 | Thêm lớp tương thích Node/Workers, bản build lớn và khó gỡ lỗi; rủi ro với Next 16 và `--webpack`; chi phí chạy Workers; chưa cần tính năng nào |
| C   | Đặt nguyên cả web vào container cùng API                                                                                                                                | Một chỗ triển khai                                                                     | Mất CDN, gánh thêm tải trên máy API, trái hướng đã chọn đưa web lên Cloudflare                                                                  |

**Chọn: A.** Web không dùng tính năng máy chủ nên xuất tĩnh là cách nhẹ nhất; hai route động xử lý được bằng quy tắc rewrite chuẩn của Pages. B để dành nếu về sau cần tính năng máy chủ. Không cần ADR: chọn hạ tầng phân phối cho web, ghi vào ADR-0011 một dòng hệ quả.

Mặc định cho câu hỏi mở:

1. Tên dự án Pages `cuelingo-web`, tên miền `cuelingo.tutorial-aws.com`.
2. Chưa có API: `NEXT_PUBLIC_API_URL` để trống và web hiện thông báo lỗi kết nối tiếng Việt (AC8).
3. Cookie đăng nhập: quyết ở hạng mục API, nhưng chọn tên miền con cùng site để không chặn khả năng đó.

| Tác động                            | Có?   | Chi tiết                                                                                   |
| ----------------------------------- | ----- | ------------------------------------------------------------------------------------------ |
| DB migration                        | Không |                                                                                            |
| Contract (`@cuelingo/shared`)       | Không |                                                                                            |
| Event / Learner Model               | Không |                                                                                            |
| Prompt / model AI                   | Không |                                                                                            |
| Quyền riêng tư / dữ liệu người dùng | Không | Web tĩnh không giữ dữ liệu; CSP giữ nguyên. Token Cloudflare chỉ nằm trong GitHub Secrets. |

## 3. Các bước (mỗi bước ≈ 1 commit)

| #   | Bước                                                                                                                                                                                                                   | File                                                                             | Điểm mở rộng |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------ |
| 1   | Hai route động đọc `id` phía client (hook từ `usePathname`), thêm `generateStaticParams` trả về một giá trị giữ chỗ; test `id` đúng cho `/sessions/<id>` và `/assistant`, `/assistant/<id>`                            | `src/app/(app)/sessions/[id]/page.tsx`, `assistant/[[...id]]/page.tsx`, hook mới | Web          |
| 2   | `build:static` (xuất tĩnh qua biến môi trường, `next build` thường giữ nguyên cho dev), `public/_redirects` rewrite `/sessions/*` và `/assistant/*` về trang giữ chỗ (AC1, AC2, AC7); kiểm bản build bằng máy chủ tĩnh | `apps/web/package.json`, `next.config.ts`, `public/_redirects`                   | Web          |
| 3   | `_headers` sinh từ `csp.ts` (một nguồn duy nhất) kèm các header bảo mật, test so khớp (AC3)                                                                                                                            | `apps/web/scripts/write-headers.mjs`, `public/_headers`, test                    | Web          |
| 4   | Kiểm biến lúc build (thiếu biến bắt buộc ở production thì hỏng) + thông báo lỗi kết nối tiếng Việt khi API không chạy (AC4, AC8); quét chuỗi nhạy cảm bản build (AC5)                                                  | `apps/web/scripts/check-env.mjs`, `src/lib/errors.ts`, workflow                  | Web          |
| 5   | Workflow `web-cloudflare.yml`: build, quét, deploy bằng `wrangler pages deploy`, action ghim SHA, chỉ chạy khi đổi web hoặc gói chung (AC6); dùng `CI=true pnpm install`                                               | `.github/workflows/web-cloudflare.yml`                                           | CI           |
| 6   | Docs: trang module, hướng dẫn H1 (tạo token, thêm secret, gắn tên miền `cuelingo.tutorial-aws.com` vào dự án Pages), ADR-0011 hệ quả; `pnpm verify`, `pnpm docs:build`; điền `03-review.md`                            | `apps/docs/docs/04-modules/02-web/**`, `08-adr/0011-*.md`                        | Docs         |

## 4. Rủi ro

| Rủi ro                                                                  | Giảm thiểu                                                                                                |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Xuất tĩnh làm hỏng một tính năng dùng `notFound()` hoặc route động khác | Bước 2 build tĩnh cả app và mở lần lượt các trang chính bằng máy chủ tĩnh; test cho route động            |
| `_headers` lệch với CSP thật                                            | Sinh từ `csp.ts`, có test so khớp                                                                         |
| `router.replace('/assistant/<id>')` và làm mới trang sai với rewrite    | Test mở thẳng `/assistant/<id>` trên bản tĩnh; kiểm khi chạy thật                                         |
| Chưa chạy thật được Cloudflare (cần token, tên miền)                    | Ghi rõ "chưa chạy thật" ở `03-review.md`; kiểm cục bộ bằng bản build và `wrangler pages dev` nếu cài được |
| Web lên mà API chưa có làm người dùng tưởng hỏng                        | Thông báo lỗi kết nối rõ ràng (AC8); không mời tester dùng web đăng nhập tới khi có API                   |

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                                                                                                         |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-08 | Plan | Trình phương án A (xuất tĩnh lên Pages); B (OpenNext) để dành khi cần tính năng máy chủ, C bị loại                                                                                                                                    |
| 2026-11-08 | Làm  | Lệch plan: hook id tách khỏi hằng thuần (server component không import được file có `usePathname`); `scan-out.mjs` riêng vì `scan-dist.mjs` của site báo sai trên thư viện; AppShell và màn đăng nhập sửa cho AC8. Xem `03-review.md` |
