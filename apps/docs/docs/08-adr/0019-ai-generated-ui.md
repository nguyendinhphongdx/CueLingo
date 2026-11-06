# 0019 · Giao diện do AI sinh ra: thẻ JSON trước, HTML/JS trong hộp cát sau

**Trạng thái:** Accepted · 2026-11-05 (lớp 1 làm ở Lô 1). Lớp 2: **đã có code ở Lô 3, tắt mặc định**, ghi chi tiết ở mục "Triển khai lớp 2" bên dưới; chưa được bật trên production.

## Bối cảnh

Người dùng muốn câu trả lời của AI là giao diện thật như ChatGPT, không chỉ Markdown. Chạy mã do AI sinh ra là rủi ro bảo mật lớn nhất của tính năng.

## Quyết định

- **Lớp 1 (Lô 1):** AI gọi tool `show_card({kind,data})`; `data` phải khớp union Zod `AgentCard` trong `@cuelingo/shared`. Web render bằng thành phần `@cuelingo/ui`. Không chạy mã lạ.
- **Markdown:** `react-markdown` + `remark-gfm`, không bật HTML thô, không tải ảnh ngoài (chặn kênh rò qua URL ảnh), link mở `rel="noopener noreferrer"`.
- **Lớp 2 (hoãn, sau cờ `AGENT_HTML_BLOCKS`, mặc định tắt):** HTML/JS chạy trong iframe `sandbox="allow-scripts"` (không `allow-same-origin`) nạp từ origin riêng, CSP bằng header HTTP (`connect-src 'none'`), watchdog, cầu nối postMessage có allowlist; thao tác ghi luôn cần xác nhận của host. Chi tiết xem [plan](../06-delivery/2026-11-05-ai-agent/02-plan.md) mục c.

## Triển khai lớp 2 (Lô 3, 2026-11-06)

- **Hợp đồng** (`@cuelingo/shared`, `agent-bridge.ts`): `html_block` là một kiểu thẻ của `AgentCardSchema` (nên đi qua đường thẻ sẵn có, không sửa `@cuelingo/agent`); HTML ≤ 64 KB theo byte. Bridge có đúng sáu thao tác (`ui.resize`, `ui.ready`, `ui.error`, `phrases.list`, `phrases.save`, `tts.speak`), tin `{v:1, id, op, args}` kiểm bằng Zod, tin quá 16 KB bị bỏ chưa đọc.
- **Công cụ** `render_html` ở plugin `html-ui`, chỉ đăng ký khi `AGENT_HTML_BLOCKS=true`; prompt `agent/v2`. Kiểm tĩnh chỉ là lớp phụ.
- **Runner** (`infra/sandbox-runner`): trang tĩnh ở origin riêng, CSP bằng header HTTP (`default-src 'none'`, `connect-src 'none'`, `form-action 'none'`, `base-uri 'none'`, `frame-src 'self' about:`), COOP/CORP, `Permissions-Policy`, `frame-ancestors` theo cấu hình. Runner dựng iframe con `sandbox="allow-scripts"` bằng `srcdoc` (kế thừa CSP) để mã sinh ra không chạm được script chuyển tiếp của runner.
- **Host** (`@cuelingo/ui`): `SandboxFrame` (iframe `sandbox="allow-scripts"`, `allow=""`, `referrerPolicy="no-referrer"`), watchdog (ready 3 giây, ping 2 giây), `bridge-host` (kiểm `source`, origin, kích thước, allowlist, schema, tần suất), `phrases.save` luôn qua `ConfirmDialog`. Web nối vào sau hai biến `NEXT_PUBLIC_*` và đặt CSP `frame-src`/`img-src` cho route chat.
- **Sai lệch so với plan, có lý do**:
  1. Kiểm `event.origin` là `"null"`, không phải `RUNNER_ORIGIN`: iframe không có `allow-same-origin` có origin mờ nên trình duyệt báo `"null"` (đã thấy trong e2e Chrome), và `postMessage` vào nó chỉ đến nơi với target `"*"`. Ranh giới thật là danh tính cửa sổ (`event.source === iframe.contentWindow`).
  2. Trần 20 thao tác/phút áp cho thao tác dữ liệu (`phrases.*`, `tts.speak`); thao tác `ui.*` (resize khi nội dung đổi) có trần riêng 120/phút, nếu không thì một trang co giãn sẽ tự chặn mình.
  3. Pong là tin riêng (`{v:1, kind:'pong', n}`), không nằm trong allowlist sáu thao tác, vì nó chỉ phục vụ watchdog.
  4. `@cuelingo/ui` thêm phụ thuộc `@cuelingo/shared` (chỉ cho nhóm sandbox) để dùng một schema bridge cho cả hai phía.

## Kết quả kiểm (Chrome, máy dev)

`pnpm --filter @cuelingo/e2e e2e:sandbox` (Chrome, runner thật, mã thoát hộp cát đi thẳng vào runner, không qua kiểm tĩnh): `parent.document`, `top.document`, `top.location`, `document.cookie`, `localStorage`, `sessionStorage` đều ném lỗi bảo mật; `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, ảnh, worker không gửi được gì (trình duyệt chặn vì CSP, không request nào tới địa chỉ rò); `window.open`, `top.location = …`, form submit, `location.href`, `<meta refresh>` không điều hướng và không mở cửa sổ; tin giả, tin quá cỡ, tin không serialise được không tới host; `while(true)` không làm luồng chính của trang chat ngừng tick (khoảng trễ lớn nhất < 1 giây, kiểm cả runner cùng site `localhost` và khác site `127.0.0.1`).

**Chưa kiểm:** WKWebView (Tauri) và Safari/Firefox; hành vi `frame-src` với điều hướng của iframe con ngoài Chrome; header CSP của route `/assistant` trên một phản hồi thật (chỉ kiểm cấu hình `headers()` bằng test); runner trên domain thật qua HTTPS; chạy với khoá Gemini thật để xem mô hình có tuân luật prompt v2 không. Review bảo mật bằng agent khác vẫn cần trước khi bật cờ.

## Hệ quả

- Lô 1 an toàn theo thiết kế vì không có đường chạy mã.
- Lớp 2 cần domain/DNS cho runner, spike Chrome + WKWebView và review bảo mật trước khi bật.
