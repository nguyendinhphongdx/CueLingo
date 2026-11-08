# web-cloudflare — Đưa web CueLingo lên Cloudflare Pages

| Trạng thái | Loại    | Nhánh / PR                   | Ước lượng → thực tế |
| ---------- | ------- | ---------------------------- | ------------------- |
| Review     | feature | `feat/web-cloudflare` / _PR_ | _0,5–1 ngày → ?_    |

**Phạm vi:** trong: build `apps/web` thành site tĩnh, chuyển CSP sang header của Cloudflare, workflow GitHub tự deploy lên Cloudflare Pages, tài liệu và hướng dẫn · ngoài: triển khai API, workers, Postgres (hạng mục riêng), tên miền riêng (làm sau, dùng `*.pages.dev` trước), R2, sửa tính năng web.

## 1. Vấn đề

Web CueLingo (đăng nhập, cụm từ, ôn tập, trợ lý, admin) chỉ chạy trên máy phát triển. Người thử bên ngoài không vào được, và bản `.dmg` trỏ về địa chỉ web (`CUELINGO_WEB_URL`) để mở trang đăng nhập nên cũng cần một địa chỉ web công khai. Chủ sản phẩm muốn đưa web lên Cloudflare trước, chưa cần chờ API. Web chạy hoàn toàn phía trình duyệt (chỉ dùng biến `NEXT_PUBLIC_*` ghi lúc build), nên có thể xuất tĩnh.

- **Spec liên quan:** `08-adr/0011-deployment-containers-sg.md`, `04-modules/02-web/`, `03-architecture/08-security-privacy.md`, `08-adr/0019-ai-generated-ui.md` (CSP của `/assistant`)
- **Module chạm tới:** `apps/web` (cấu hình build, 2 route động), `.github/workflows/`

## 2. Tiêu chí chấp nhận (EARS)

| #   | AC                                                                                                                                                                            | Test                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| AC1 | THE SYSTEM SHALL build `apps/web` thành thư mục tĩnh (HTML/JS/CSS) không cần runtime Node, kèm lệnh `pnpm --filter @cuelingo/web build:static`                                | build trong CI + kiểm thư mục đầu ra              |
| AC2 | WHEN mở một đường dẫn của app trực tiếp (làm mới trang) THE SYSTEM SHALL hiện đúng trang, kể cả `/sessions/<id>` và `/assistant/<id>`                                         | e2e/kiểm bản build qua máy chủ tĩnh               |
| AC3 | THE SYSTEM SHALL gửi các header bảo mật (CSP có `frame-src` của runner hộp cát, X-Content-Type-Options, Referrer-Policy) bằng file `_headers`, nội dung khớp cấu hình hiện có | test so khớp `_headers` với `csp.ts`              |
| AC4 | THE SYSTEM SHALL lấy `NEXT_PUBLIC_API_URL` và các biến công khai khác từ biến GitHub lúc build, và build thất bại nếu thiếu biến bắt buộc ở production                        | test script kiểm biến                             |
| AC5 | THE SYSTEM SHALL không chứa secret, khoá riêng hay token dev trong bản build tĩnh                                                                                             | bước quét chuỗi nhạy cảm trong workflow           |
| AC6 | WHEN đẩy vào `main` có thay đổi ở `apps/web`, `packages/ui`, `packages/shared`, `packages/core-sdk` hoặc workflow THE SYSTEM SHALL tự deploy lên Cloudflare Pages             | workflow chạy được `actionlint`; chạy thật cần H1 |
| AC7 | THE SYSTEM SHALL giữ build web hiện tại (`next build`, `next dev`) chạy bình thường cho phát triển cục bộ                                                                     | `pnpm verify` xanh, test web giữ nguyên           |
| AC8 | WHEN chưa có API công khai THEN THE SYSTEM SHALL vẫn hiện được trang giới thiệu và trang tải về, và báo lỗi kết nối bằng tiếng Việt ở các màn cần API thay vì trắng trang     | kiểm bản build với API không chạy                 |
| AC9 | THE SYSTEM SHALL ghi lại trong tài liệu các bước H1 (tạo dự án Pages, token, biến) và nói rõ web đăng nhập được chỉ sau khi API công khai và CORS/cookie được cấu hình        | docs build + rà soát                              |

## 3. Câu hỏi mở

- [ ] Tài khoản Cloudflare đã có chưa, tên dự án Pages muốn đặt là gì? (đề xuất `cuelingo-web`, địa chỉ `cuelingo-web.pages.dev`)
- [ ] Tên miền là `tutorial-aws.com` (chủ sản phẩm, 2026-11-08), sẽ tạo tên miền con. Đề xuất: web `cuelingo.tutorial-aws.com`, API (sau này) `api-cuelingo.tutorial-aws.com`, cùng site nên cookie đăng nhập dùng chung được. DNS của tên miền đã nằm ở Cloudflare (chủ sản phẩm xác nhận 2026-11-08), nên gắn tên miền tuỳ chỉnh vào Pages được thẳng trong Cloudflare.
- [ ] Runner hộp cát HTML (ADR 0019) phải ở **site khác** web. Tên miền con của `tutorial-aws.com` là cùng site nên **không dùng được** cho runner; cần một tên miền khác, hoặc để cờ `AGENT_HTML_BLOCKS` tắt (đang tắt).
- [ ] Xuất tĩnh có đủ không? Đề xuất: đủ, vì web không dùng tính năng máy chủ. Nếu về sau cần, chuyển sang OpenNext trên Workers.
- [ ] Đăng nhập web dùng cookie hay token? Nếu cookie, web và API cần cùng site (tên miền cha chung) khi triển khai API — việc này quyết ở hạng mục API, nhưng ảnh hưởng chọn tên miền.
- [ ] Biến `NEXT_PUBLIC_API_URL` tạm thời trỏ đâu khi chưa có API? (đề xuất để trống và hiện thông báo AC8)

## Việc cần chủ sản phẩm làm (không tự làm được)

- **H1** Tạo dự án Cloudflare Pages (hoặc cho phép workflow tạo), tạo API token Cloudflare với quyền Pages, thêm secret `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` vào repo GitHub và biến `CUELINGO_WEB_PROJECT`.

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                                                                                                                                                           |
| ---------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-08 | Spec | Mở hồ sơ. Chủ sản phẩm chọn đưa web lên Cloudflare trước, xuất tĩnh; API/workers/Postgres làm ở hạng mục riêng                                                                                                                                                                          |
| 2026-11-08 | Làm  | Làm xong cả 6 bước ở `feat/web-cloudflare`. Chưa deploy thật (cần H1). `_headers` sinh vào `out/` thay vì `public/`; workflow thêm chạy trên pull request; `CUELINGO_API_URL` trống thì build với `https://api.invalid` để web lên được khi chưa có API (AC8). Chi tiết: `03-review.md` |
