# Deploy lên Cloudflare Pages

> Phần: [Web app](./README.md) · Code: `apps/web/` (`next.config.ts`, `scripts/`, `public/_redirects`), `.github/workflows/web-cloudflare.yml` · Hồ sơ: [web-cloudflare](../../06-delivery/2026-11-08-web-cloudflare/02-plan.md) · Quyết định: [ADR 0011](../../08-adr/0011-deployment-containers-sg.md)

Web được xuất thành file tĩnh (HTML/JS/CSS) và đưa lên Cloudflare Pages. Không có Node ở phía chạy: web chỉ dùng biến `NEXT_PUBLIC_*` ghi lúc build và gọi API từ trình duyệt.

## Trách nhiệm

- `pnpm --filter @cuelingo/web build:static`: kiểm biến, xuất tĩnh ra `apps/web/out/`, sinh `out/_headers`. `next dev` và `next build` giữ nguyên (cờ `NEXT_STATIC_EXPORT=true` chỉ bật trong `build:static`).
- Hai route động (`/sessions/[id]`, `/assistant/[[...id]]`) xuất thành **một trang giữ chỗ** (`/sessions/_`, `/assistant/_`). `public/_redirects` rewrite (200) mọi `/sessions/*` và `/assistant/*` về trang đó; `id` đọc ở trình duyệt bằng `useRouteId` (`src/lib/use-route-id.ts`) từ `usePathname`, không đọc từ `params` của máy chủ.
- Header bảo mật: `securityHeaders()` ở `src/lib/csp.ts` là nguồn duy nhất cho `next.config.ts` và `scripts/write-headers.mjs` (CSP có `frame-src` của runner hộp cát, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`). Test `scripts/write-headers.test.ts` giữ hai nơi bằng nhau.
- Workflow `web-cloudflare.yml`: cài, build, quét, deploy bằng `wrangler pages deploy`.

## Phạm vi MVP

- Chạy được khi **chưa có API**: trang giới thiệu và tải về vẫn hiện; màn cần API hiện "Không kết nối được tới máy chủ CueLingo…" kèm nút Thử lại (`ConnectionProblem` trong `AppShell`, `loginErrorMessage` ở màn đăng nhập).
- **Đăng nhập chỉ dùng được khi API công khai đã chạy và CORS/cookie đã cấu hình** (xem [Giới hạn](#giới-hạn)).
- Chưa gắn tên miền riêng trong code: làm ở Cloudflare (H1 bước 5).

## Interface

| Thành phần              | Nội dung                                                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lệnh                    | `pnpm --filter @cuelingo/web build:static` (kiểm biến, build, `_headers`) · `scan:static` (quét `out/`)                                                                                                                                                |
| Biến build (GitHub)     | `CUELINGO_API_URL` → `NEXT_PUBLIC_API_URL` (**bắt buộc**, https, không phải máy cục bộ) · tuỳ chọn: `CUELINGO_DOWNLOAD_URL`, `CUELINGO_GOOGLE_ENABLED`, `CUELINGO_SANDBOX_ORIGIN`, `CUELINGO_AGENT_HTML_BLOCKS`                                        |
| Biến deploy (GitHub)    | `CUELINGO_WEB_PROJECT` (tên dự án Pages)                                                                                                                                                                                                               |
| Secret (GitHub)         | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`                                                                                                                                                                                                        |
| `scripts/check-env.mjs` | Hỏng build nếu thiếu `NEXT_PUBLIC_API_URL`, không phải https hay trỏ về `localhost`; kiểm `SANDBOX_ORIGIN`, cờ `true/false`, `DOWNLOAD_URL`                                                                                                            |
| `scripts/scan-out.mjs`  | Quét `out/`: khoá riêng, token GitHub, khoá cloud, tên secret Cloudflare/ký app, `dev-token`, địa chỉ `localhost:cổng`, và các chuỗi trong `FORBIDDEN_STRINGS` (workflow đưa chính hai secret Cloudflare vào đó). In tên tệp và luật, không in giá trị |
| Kích hoạt               | Push `main` đổi `apps/web`, `packages/{ui,shared,core-sdk}`, `pnpm-lock.yaml` hoặc workflow → build, quét, deploy. Pull request cùng đường dẫn → build và quét, không deploy. `workflow_dispatch` trên `main` → deploy                                 |

Khi `CUELINGO_API_URL` chưa đặt, workflow dùng `https://api.invalid` (tên không bao giờ phân giải) và in cảnh báo; mọi màn cần API báo không kết nối được.

## Phụ thuộc

- Cloudflare Pages (nhà cung cấp phân phối web, dữ liệu người dùng không đi qua đây: site tĩnh) · `wrangler@4.158.0` chạy qua `pnpm dlx`.
- Action ghim SHA như `pages.yml`. Node 24 trong CI.
- API công khai + CORS/cookie (hạng mục riêng) để đăng nhập hoạt động.

## Dữ liệu & sự kiện

Không có. Site tĩnh không giữ dữ liệu; token Cloudflare chỉ nằm trong GitHub Secrets và không vào bản build (bước quét kiểm).

## Giới hạn

| Chủ đề                       | Ghi chú                                                                                                                                                                                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Đăng nhập                    | Better Auth đặt cookie trên **origin của API**. Web (`cuelingo.tutorial-aws.com`) và API (đề xuất `api-cuelingo.tutorial-aws.com`) cùng site, nên cookie `SameSite=Lax` gửi được; API cần CORS cho đúng origin web kèm credentials. Chưa làm ở hạng mục này                                                        |
| Runner hộp cát               | Phải ở **site khác** web ([ADR 0019](../../08-adr/0019-ai-generated-ui.md)). Tên miền con của `tutorial-aws.com` là cùng site nên không dùng được; cờ `AGENT_HTML_BLOCKS` giữ tắt cho đến khi có tên miền khác                                                                                                     |
| Chuyển trang                 | Điều hướng client tới `/sessions/<id>` mới (chưa có trong bản xuất) làm Next xin payload RSC không có trong bản xuất, `_redirects` trả trang HTML, nên Next sẽ chuyển sang tải lại cả trang. Dự kiến đúng nhưng có một lần tải lại; **chưa quan sát** (bản kiểm cục bộ chỉ mở thẳng địa chỉ, chưa bấm link nội bộ) |
| `_redirects` và tệp thật     | Cách Pages ưu tiên: tệp tĩnh có thật thắng rewrite 200 (như cách chạy SPA `/* /index.html 200`). Dựa vào tài liệu, **chưa thử trên Cloudflare thật**                                                                                                                                                               |
| Cần tính năng máy chủ về sau | Chuyển sang OpenNext trên Workers (phương án B trong plan)                                                                                                                                                                                                                                                         |

## Câu hỏi mở

- Tên dự án Pages chính thức (đề xuất `cuelingo-web`) và tài khoản Cloudflare — chủ sản phẩm.
- Cookie đăng nhập: `Domain=.tutorial-aws.com` hay cookie của API — quyết ở hạng mục API.
- Tên miền khác cho runner hộp cát nếu muốn bật khối HTML.

---

# H1 · Việc của chủ sản phẩm (làm một lần)

Làm theo thứ tự. Mục tiêu: push vào `main` thì web tự lên `https://<tên-dự-án>.pages.dev`, rồi gắn `cuelingo.tutorial-aws.com`.

## 1. Tạo dự án Pages

1. Đăng nhập [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → tab **Pages** → **Upload your static files** (Direct Upload).
2. Đặt tên dự án, ví dụ `cuelingo-web`. Tải lên một thư mục bất kỳ để tạo dự án (workflow sẽ ghi đè bằng bản thật).
3. Ghi lại tên dự án; đây là giá trị `CUELINGO_WEB_PROJECT`.

## 2. Lấy Account ID

Trong **Workers & Pages** (cột phải) hoặc **Overview** của tài khoản: sao chép **Account ID**.

## 3. Tạo API token có quyền Pages

1. Góc phải trên → **My Profile** → **API Tokens** → **Create Token** → **Create Custom Token**.
2. Permissions: **Account** · **Cloudflare Pages** · **Edit**.
3. Account Resources: **Include** · tài khoản của bạn. Không cấp thêm quyền khác.
4. **Create Token** và sao chép token ngay (chỉ hiện một lần).

## 4. Thêm vào GitHub

Repo → **Settings** → **Secrets and variables** → **Actions**.

| Loại     | Tên                     | Giá trị                                                                                        |
| -------- | ----------------------- | ---------------------------------------------------------------------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`  | token bước 3                                                                                   |
| Secret   | `CLOUDFLARE_ACCOUNT_ID` | Account ID bước 2                                                                              |
| Variable | `CUELINGO_WEB_PROJECT`  | tên dự án bước 1                                                                               |
| Variable | `CUELINGO_API_URL`      | địa chỉ https công khai của API; **bỏ trống** nếu chưa có API (web vẫn lên, báo không kết nối) |

Tuỳ chọn: `CUELINGO_DOWNLOAD_URL`, `CUELINGO_GOOGLE_ENABLED` (`true`/`false`). Để trống `CUELINGO_SANDBOX_ORIGIN` và `CUELINGO_AGENT_HTML_BLOCKS` (xem Giới hạn).

## 5. Gắn tên miền `cuelingo.tutorial-aws.com`

DNS của `tutorial-aws.com` đã ở Cloudflare nên gắn thẳng được:

1. Dự án Pages → **Custom domains** → **Set up a custom domain**.
2. Nhập `cuelingo.tutorial-aws.com` → **Continue** → **Activate domain**. Cloudflare tự thêm bản ghi CNAME và cấp chứng chỉ.
3. Đợi trạng thái **Active** (vài phút), rồi mở `https://cuelingo.tutorial-aws.com`.

## 6. Chạy lần đầu và kiểm

1. Repo → **Actions** → **Web (Cloudflare Pages)** → **Run workflow** trên `main`.
2. Mở địa chỉ web. Phải thấy trang giới thiệu và `/download`. Mở thẳng `/sessions/abc` (làm mới trang) phải ra trang web, không phải 404 của Cloudflare.
3. Chưa có API thì vào `/glossary` sẽ thấy "Không kết nối được tới máy chủ CueLingo…": đúng như thiết kế.

Đổi `CUELINGO_API_URL` xong phải chạy lại workflow (biến được ghi vào file lúc build).

## Khi lỗi

| Hiện tượng                           | Nguyên nhân thường gặp                                             |
| ------------------------------------ | ------------------------------------------------------------------ |
| `check-env: NEXT_PUBLIC_API_URL ...` | Biến `CUELINGO_API_URL` sai (http, `localhost`)                    |
| `CUELINGO_WEB_PROJECT is not set`    | Chưa đặt biến, hoặc tên có chữ hoa/ký tự lạ                        |
| Wrangler `Authentication error`      | Token thiếu quyền Pages · Edit, hoặc Account ID sai                |
| Quét báo `development address`       | Có `http://localhost:…` trong bản build: kiểm biến `NEXT_PUBLIC_*` |
| Đăng nhập không giữ phiên            | API chưa cho CORS/cookie đúng origin web (hạng mục API)            |
