# Sandbox runner

Trang tĩnh chạy khối HTML/JS do trợ lý AI viết ([ADR 0019](../../apps/docs/docs/08-adr/0019-ai-generated-ui.md), lớp 2). **Chỉ cần khi bật `AGENT_HTML_BLOCKS`** (mặc định tắt).

Phải chạy ở **origin riêng** (dev `http://localhost:3101`, production ví dụ `https://sandbox.<domain>`), không bao giờ cùng origin với web. Web nhúng nó bằng `<iframe sandbox="allow-scripts">` (không `allow-same-origin`).

| Việc                       | Lệnh                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| Chạy dev (cổng 3101)       | `pnpm sandbox:dev`                                                                                  |
| Chạy bằng Docker           | `docker compose -f infra/docker-compose.yml --profile sandbox up -d sandbox-runner`                 |
| Biến môi trường của server | `PORT` (3101), `HOST` (127.0.0.1), `RUNNER_FRAME_ANCESTORS` (origin được nhúng; trống thì không ai) |
| Deploy tĩnh (production)   | Đưa `runner.html` lên host tĩnh và áp `_headers` (đổi `frame-ancestors` thành origin web)           |

Trong `.env`: API `AGENT_HTML_BLOCKS=true`; web `NEXT_PUBLIC_AGENT_HTML_BLOCKS=true`, `NEXT_PUBLIC_SANDBOX_ORIGIN=http://localhost:3101`.

## Gồm gì

- `runner.html`: một script nội tuyến. Nhận `render` từ host đúng một lần, dựng iframe con `sandbox="allow-scripts"` bằng `srcdoc` (CSP của runner được kế thừa), chuyển tiếp yêu cầu bridge của trang con lên host và câu trả lời xuống, chuyển ping/pong. Chỉ chuyển sáu thao tác trong allowlist; mọi quyết định do host đưa ra.
- `headers.mjs`: CSP (`default-src 'none'`, `connect-src 'none'`, `form-action 'none'`, `base-uri 'none'`, `frame-src 'self' about:`, ảnh/media/font chỉ `data:`/`blob:`), COOP, CORP, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` tắt camera, mic, vị trí, clipboard. `_headers` lặp lại cho host tĩnh; test giữ hai bên khớp.
- `server.mjs`: server Node không phụ thuộc, chỉ GET/HEAD `/runner.html`, `/`, `/healthz`; không cookie, không lưu trữ.
- `runner.test.mjs`: test header, nội dung `runner.html` và handler (chạy trong `pnpm test`).

## Còn phải làm bởi người

- Domain/DNS và chỗ deploy tĩnh cho production; đặt `frame-ancestors` đúng origin web.
- Spike trên Chrome và WKWebView (Tauri): `while(true)` có treo tab không, CSP `frame-src` có chặn điều hướng của iframe con không. Test e2e ở `e2e/tests/assistant-sandbox.spec.ts` kiểm trên Chrome; WebKit chưa được kiểm.
