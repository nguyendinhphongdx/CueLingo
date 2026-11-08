# Review — web-cloudflare

## Thay đổi so với plan

| Dấu         | File / hành vi                                                                                                                             | Chi tiết (lý do nếu khác plan)                                                                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 ADDED    | `src/lib/route-id.ts` (+test), `src/lib/use-route-id.ts`, `features/{debrief,assistant}/*Route.tsx`                                        | Hook tách khỏi hằng/hàm thuần vì trang server import `PLACEHOLDER_ID`; file có `usePathname` không import được vào server component. Trang chỉ render `DebriefRoute`/`AssistantRoute` (client) thay vì truyền `id` từ `params`                                       |
| 🟡 MODIFIED | `app/(app)/sessions/[id]/page.tsx`, `assistant/[[...id]]/page.tsx`                                                                         | Thêm `generateStaticParams` (`_`; `/assistant` thêm `[]`). Cả `next build` thường cũng prerender `/sessions/_`, vô hại. **Chỗ rủi ro:** `id` giờ chỉ có sau khi trình duyệt chạy (lần vẽ đầu trên máy chủ không có id)                                               |
| 🟡 MODIFIED | `next.config.ts`                                                                                                                           | `output: 'export'` chỉ khi `NEXT_STATIC_EXPORT=true`; bỏ `headers()` khi xuất tĩnh. Headers thường nay gồm cả `X-Content-Type-Options` và `Referrer-Policy` (cùng nguồn `securityHeaders`), nên `next dev/build` cũng gửi thêm hai header này                        |
| 🟢 ADDED    | `public/_redirects`, `scripts/write-headers.mjs`, `scripts/check-env.mjs`, `scripts/scan-out.mjs` (+3 test), `build:static`, `scan:static` | Khác plan: `_headers` **sinh vào `out/_headers`** chứ không để `public/_headers`, vì nội dung phụ thuộc biến build (origin runner); file sinh ra không nên commit. Script chạy bằng `node --experimental-strip-types` để import thẳng `csp.ts`                       |
| 🟢 ADDED    | `scan-out.mjs` riêng thay vì dùng `apps/site/scripts/scan-dist.mjs`                                                                        | Chạy thử `scan-dist.mjs` trên bản xuất: luật "development host" bắt từ `localhost` bằng chữ nên báo sai ở thư viện và câu hướng dẫn. Bản web chỉ bắt địa chỉ (`http://localhost:cổng`), thêm tên secret Cloudflare, bỏ `BETTER_AUTH_SECRET` (tên env trong thư viện) |
| 🟡 MODIFIED | `features/auth/AppShell.tsx`, `use-login.ts`, `login-error.ts`, `lib/errors.ts`                                                            | AC8. Trước đây API chết thì `AppShell` đẩy sang `/login`, và màn đăng nhập hiện nguyên chữ "Failed to fetch". Nay: màn báo không kết nối + Thử lại; đăng nhập báo tiếng Việt. Ngoài danh sách file của plan nhưng cùng AC8                                           |
| 🟢 ADDED    | `.github/workflows/web-cloudflare.yml`                                                                                                     | Thêm chạy trên pull request (chỉ build + quét, không deploy) để lỗi xuất tĩnh lộ sớm. Deploy chỉ ở `main`. `CUELINGO_API_URL` trống → `https://api.invalid` + cảnh báo, để deploy được khi chưa có API (AC8)                                                         |
| 🟡 MODIFIED | `.gitignore`, `.prettierignore`, `eslint.config.mjs`, `.dependency-cruiser.cjs`                                                            | Bỏ qua `apps/web/out/` (file sinh ra). Không có thì lint báo hơn 5000 lỗi trên JS đã nén                                                                                                                                                                             |
| 🟢 ADDED    | `04-modules/02-web/deploy-cloudflare.md`, dòng ở `README.md`, `assistant.md`, ADR 0011, `apps/web/AGENTS.md`                               | Trang module + hướng dẫn H1; ADR 0011 một dòng Hệ quả                                                                                                                                                                                                                |

**Docs đã cập nhật:** `04-modules/02-web/{deploy-cloudflare,README,assistant}.md`, `08-adr/0011-deployment-containers-sg.md`, `apps/web/AGENTS.md`.

## Kết quả theo AC

| AC  | Trạng thái              | Bằng chứng / chưa kiểm                                                                                                                                                                                                                     |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1 | Đạt                     | `build:static` tạo `out/` 21 trang tĩnh, không runtime Node. Đã chạy                                                                                                                                                                       |
| AC2 | Một phần                | Mở trong Chrome thật (headless) `/sessions/abc-123`, `/assistant`, `/assistant/conv-9`: rewrite về trang giữ chỗ, API nhận đúng id (`/v1/sessions/abc-123`, `/v1/conversations/conv-9`). **Giả lập luật Pages**, chưa chạy trên Cloudflare |
| AC3 | Đạt                     | `write-headers.test.ts`: `_headers` bằng đúng header `next.config` trả; có `frame-src`, nosniff, referrer                                                                                                                                  |
| AC4 | Đạt                     | `check-env.test.ts`; build không có `NEXT_PUBLIC_API_URL` thất bại với thông báo rõ. Biến lấy từ GitHub variable trong workflow (chưa chạy trên GitHub)                                                                                    |
| AC5 | Đạt (cục bộ)            | `scan-out.test.ts`; `scan:static` trên bản xuất thật: 160 tệp, sạch. Bước trong workflow chưa chạy trên GitHub                                                                                                                             |
| AC6 | Một phần                | Workflow có path filter, SHA ghim, `CI=true pnpm install`. `actionlint` bản wasm cũ chỉ báo `vars` không tồn tại (báo sai, y hệt trên `pages.yml`). **Chưa chạy trên GitHub, chưa deploy thật** (cần H1)                                   |
| AC7 | Đạt                     | `pnpm verify` xanh; `pnpm --filter @cuelingo/web build` (webpack) vẫn qua                                                                                                                                                                  |
| AC8 | Đạt (kiểm với API chết) | Bản xuất, API không phân giải: `/` và `/download` hiện bình thường; `/glossary`, `/sessions/abc`, `/assistant/zz` hiện "Không kết nối được tới máy chủ CueLingo…"; đăng nhập báo cùng câu                                                  |
| AC9 | Đạt                     | `deploy-cloudflare.md` có H1 từng bước và mục Giới hạn (đăng nhập cần API công khai + CORS/cookie). `pnpm docs:build` xanh                                                                                                                 |

## Tự review

Theo [checklist](../../05-engineering/conventions/code-review.md): ranh giới & bảo mật (không `userId`, không secret vào bản build, bước quét có chính hai secret Cloudflare) · hợp đồng (không đổi) · kiến trúc (route chỉ render component feature; env chỉ đọc ở `config.ts`) · AI (không) · test · docs · phạm vi (không đụng `apps/desktop`).

```bash
pnpm verify      # xanh: format:check, lint, typecheck, test (207 file / 1583 test), check:deps
pnpm docs:build  # xanh, không link hỏng
```

**Đã chạy thật**

- `pnpm verify` và `pnpm docs:build` ở Node 22.14 (repo yêu cầu ≥ 22.19, pnpm chỉ cảnh báo); cài bằng `CI=true pnpm install --frozen-lockfile`.
- `NEXT_PUBLIC_API_URL=https://api.cuelingo.test pnpm --filter @cuelingo/web build:static`, rồi `scan:static`.
- Mở bản xuất trong Chrome (Playwright, `channel: chrome`) qua một máy chủ giả lập: tệp tĩnh trước, rồi luật `_redirects` 200, rồi `404.html`; áp `_headers`. Có hai lượt: API trả lời giả (đăng nhập giả, kiểm id đi đúng vào lời gọi API) và API không phân giải (kiểm thông báo).

**Chưa chạy / không kiểm được**

- **Deploy thật lên Cloudflare** (`wrangler pages deploy`), token, tài khoản, dự án Pages: cần H1.
- **Tên miền `cuelingo.tutorial-aws.com`**: chưa gắn.
- **Luật `_redirects` trên Cloudflare thật**: mình giả lập thứ tự "tệp thật thắng rewrite 200" theo tài liệu. Nếu Pages ưu tiên khác (rewrite thắng cả tệp thật), các tệp `/sessions/_.*`, `/assistant/_.*` có thể bị rewrite về chính nó; cần thử sau deploy đầu tiên.
- **Hành vi với API thật**: đăng nhập thật, cookie/CORS, dữ liệu thật. API trả lời trong lúc kiểm là giả (chỉ `get-session`; mọi đường khác 404).
- **Điều hướng nội bộ** tới `/sessions/<id>` bằng link (Next xin payload RSC không có → tải lại cả trang): chưa quan sát, chỉ mở thẳng địa chỉ.
- **`wrangler pages dev`**: cài được nhưng sandbox chặn mở cổng cục bộ (`EPERM` 9229), nên không dùng để kiểm. Cách tự kiểm: `pnpm --filter @cuelingo/web build:static` (kèm `NEXT_PUBLIC_API_URL=https://...`), rồi `npx wrangler pages dev apps/web/out`.
- **GitHub Actions**: workflow chưa chạy trên GitHub; SHA action lấy lại từ `pages.yml`. `actionlint` chuẩn không cài được (không tải được từ Go proxy trong sandbox), dùng bản wasm cũ.
- Giao diện trực quan: chỉ đọc chữ trên trang, không xem ảnh chụp.

## Cho người review — đọc theo thứ tự

| #   | File                                                                       | Soi gì                                                                                          |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | `apps/web/src/lib/route-id.ts`, `use-route-id.ts`, hai `*Route`            | `id` chỉ đọc ở trình duyệt; `_` bị loại; id lạ (`%`) không làm hỏng                             |
| 2   | `apps/web/next.config.ts`, `public/_redirects`                             | Cờ chỉ bật trong `build:static`; luật rewrite có tới được tệp thật không                        |
| 3   | `apps/web/src/lib/csp.ts` (`securityHeaders`), `scripts/write-headers.mjs` | Một nguồn cho hai nơi; thêm hai header cho `next dev/build`                                     |
| 4   | `apps/web/scripts/check-env.mjs`, `scan-out.mjs`                           | Luật quá chặt/lỏng? `localhost` chữ trần được phép, địa chỉ `http://localhost:cổng` thì không   |
| 5   | `apps/web/src/features/auth/AppShell.tsx`, `use-login.ts`                  | Mọi `error` của `useSession` đều coi là không kết nối (không chỉ lỗi mạng): 5xx cũng ra màn này |
| 6   | `.github/workflows/web-cloudflare.yml`                                     | `api.invalid` khi thiếu biến; chỉ deploy ở `main`; `FORBIDDEN_STRINGS` chứa secret              |

## Lỗi tìm thấy khi review/test

| Lỗi                                                                                               | Tìm ở                                    | Sửa                                                                             |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| `next build` lỗi "importing a module that depends on `usePathname` into a React Server Component" | Build tĩnh lần đầu                       | Tách `route-id.ts` (thuần) khỏi `use-route-id.ts` (hook); gộp vào commit bước 1 |
| `tsc`: `ProcessEnv` không có thuộc tính chung với `HeaderEnv`                                     | Typecheck sau khi thêm `securityHeaders` | `HeaderEnv = Record<string, string \| undefined>`                               |
| ESLint báo 5111 lỗi trên `apps/web/out/`                                                          | `eslint apps/web` sau build tĩnh         | Thêm `apps/web/out/**` vào ignore                                               |
| Quét của site báo "development host" trên chunk thư viện                                          | Chạy `scan-dist.mjs` trên `out/`         | Viết `scan-out.mjs` riêng (xem bảng trên)                                       |
| Quét báo `BETTER_AUTH_SECRET` trong chunk `better-auth`                                           | `scan:static`                            | Bỏ khỏi luật: chỉ là tên biến môi trường trong thư viện                         |
| Màn đăng nhập hiện "Failed to fetch" khi API chết                                                 | Mở bản xuất, gửi form đăng nhập          | `loginErrorMessage` đổi `TypeError` thành câu tiếng Việt                        |
