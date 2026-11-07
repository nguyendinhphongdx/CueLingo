# 0019 · Giao diện do AI sinh ra: thẻ JSON trước, HTML/JS trong hộp cát sau

**Trạng thái:** Accepted · 2026-11-05 (lớp 1 làm ở Lô 1). Lớp 2: **đã có code ở Lô 3, tắt mặc định**, ghi chi tiết ở mục "Triển khai lớp 2" bên dưới; chưa được bật trên production.

## Bối cảnh

Người dùng muốn câu trả lời của AI là giao diện thật như ChatGPT, không chỉ Markdown. Chạy mã do AI sinh ra là rủi ro bảo mật lớn nhất của tính năng.

## Quyết định

- **Lớp 1 (Lô 1):** AI gọi tool `show_card({kind,data})`; `data` phải khớp union Zod `AgentCard` trong `@cuelingo/shared`. Web render bằng thành phần `@cuelingo/ui`. Không chạy mã lạ.
- **Markdown:** `react-markdown` + `remark-gfm`, không bật HTML thô, không tải ảnh ngoài (chặn kênh rò qua URL ảnh), link mở `rel="noopener noreferrer"`.
- **Lớp 2 (hoãn, sau cờ `AGENT_HTML_BLOCKS`, mặc định tắt):** HTML/JS chạy trong iframe `sandbox="allow-scripts"` (không `allow-same-origin`) nạp từ origin riêng, CSP bằng header HTTP (`connect-src 'none'`), watchdog, cầu nối postMessage có allowlist; thao tác ghi luôn cần xác nhận của host. Chi tiết xem [plan](../06-delivery/2026-11-05-ai-agent/02-plan.md) mục c.

## Triển khai lớp 2 (Lô 3, 2026-11-06)

- **Hợp đồng** (`@cuelingo/shared`, `agent-bridge.ts`): `html_block` là một kiểu thẻ của `AgentCardSchema` (nên đi qua đường thẻ sẵn có, không sửa `@cuelingo/agent`); HTML ≤ 64 KB theo byte. Bridge có đúng sáu thao tác (`ui.resize`, `ui.ready`, `ui.error`, `phrases.list`, `phrases.save`, `tts.speak`), tin `{v:1, id, op, args}` kiểm bằng Zod, tin quá 16 KB bị runner bỏ trước khi chuyển lên và bị host từ chối trước khi qua Zod (host vẫn phải `JSON.stringify` tin để đo, nên "chưa đọc" chỉ đúng với bước parse, không đúng với bước đo).
- **Công cụ** `render_html` ở plugin `html-ui`, chỉ đăng ký khi `AGENT_HTML_BLOCKS=true`; prompt `agent/v2`. Kiểm tĩnh chỉ là lớp phụ.
- **Runner** (`infra/sandbox-runner`): trang tĩnh ở origin riêng, CSP bằng header HTTP (`default-src 'none'`, `connect-src 'none'`, `form-action 'none'`, `base-uri 'none'`, `frame-src 'none'`, `child-src 'none'`, `prefetch-src 'none'`, `worker-src 'none'`, `object-src 'none'`), `X-DNS-Prefetch-Control: off`, COOP/CORP, `Permissions-Policy`, `frame-ancestors` theo cấu hình. Runner dựng iframe con `sandbox="allow-scripts"` bằng `srcdoc` (kế thừa CSP) để mã sinh ra không chạm được script chuyển tiếp của runner. `srcdoc` không chịu `frame-src` nên khung lồng giữ được dù header cấm mọi frame; trang lồng còn có `<meta>` CSP (`frame-src 'none'; child-src 'none'`) và `x-dns-prefetch-control: off` đặt trước đoạn khởi động, khoá `RTCPeerConnection`/`webkitRTCPeerConnection`/`RTCDataChannel` (không cấu hình lại được) và gỡ mọi phần tử `<link>` do script thêm. Runner từ chối dựng trang có phần tử `<link>` (parse bằng `DOMParser`, kể cả trong `<template>`).
- **Host** (`@cuelingo/ui`): `SandboxFrame` (iframe `sandbox="allow-scripts"`, `allow=""`, `referrerPolicy="no-referrer"`), watchdog (ready 3 giây, ping 2 giây), `bridge-host` (kiểm `source`, origin, kích thước, allowlist, schema, tần suất), `phrases.save` luôn qua `ConfirmDialog`. Web nối vào sau hai biến `NEXT_PUBLIC_*` và đặt CSP `frame-src`/`img-src` cho mọi route (điều hướng phía client sang `/assistant` giữ chính sách của trang đã tải). Hộp thoại lưu mở với "Huỷ" được focus, "Lưu" bị khoá 600 ms, chữ do AI viết được cắt và đặt trong ngoặc kép; xin lưu bị từ chối 2 lần thì khối bị dừng. `phrases.list` cũng phải qua hộp thoại (một lần mỗi khối). Tool `render_html` chỉ trả cho mô hình `{rendered, title, problem}`, không trả lại mã (hook `forModel` nhỏ trong `@cuelingo/agent`). `SANDBOX_ORIGIN` trùng origin API hoặc origin trang bị từ chối; production cần registrable domain riêng cho runner.
- **Sai lệch so với plan, có lý do**:
  1. Kiểm `event.origin` là `"null"`, không phải `RUNNER_ORIGIN`: iframe không có `allow-same-origin` có origin mờ nên trình duyệt báo `"null"` (đã thấy trong e2e Chrome), và `postMessage` vào nó chỉ đến nơi với target `"*"`. Ranh giới thật là danh tính cửa sổ (`event.source === iframe.contentWindow`).
  2. Trần 20 thao tác/phút áp cho thao tác dữ liệu (`phrases.*`, `tts.speak`); thao tác `ui.*` (resize khi nội dung đổi) có trần riêng 120/phút, nếu không thì một trang co giãn sẽ tự chặn mình.
  3. Pong là tin riêng (`{v:1, kind:'pong', n}`), không nằm trong allowlist sáu thao tác, vì nó chỉ phục vụ watchdog.
  4. `@cuelingo/ui` thêm phụ thuộc `@cuelingo/shared` (chỉ cho nhóm sandbox) để dùng một schema bridge cho cả hai phía.

## Kết quả kiểm (Chrome, máy dev)

`pnpm --filter @cuelingo/e2e e2e:sandbox` (Chrome thật, runner thật, mã thoát hộp cát đi thẳng vào runner, không qua kiểm tĩnh; mỗi phép đo có đối chứng cùng mã chạy ở trang host thường để chứng tỏ cổng bắt được rò):

- **Chặn được (đo bằng cổng TCP/UDP trên loopback):** `parent.document`, `top.document`, `top.location`, `document.cookie`, `localStorage`, `sessionStorage` ném lỗi bảo mật; `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, ảnh, worker không gửi gì; WebRTC (STUN) không gửi gói UDP nào, cả khi gọi trực tiếp lẫn từ khung `about:blank` mới; phần tử `<link>` trong markup bị runner từ chối (không dựng trang) và không có request nào; `<link>` do script thêm vào (preconnect, dns-prefetch, prefetch, modulepreload, `document.write`) không có request nào; frame do script tạo tới URL bất kỳ không gửi request; `window.open`, `top.location = …`, form submit không mở gì; tin giả, quá cỡ, không serialise được không tới host; `while(true)` không làm luồng chính của trang chat ngừng tick.
- **KHÔNG chặn được (đã đo, còn tồn tại):**
  1. _Điều hướng khung của chính nó_ (`location.href`, `location.replace`, `<meta refresh>` tĩnh hoặc chèn, bấm link): `frame-src 'none'` chặn request HTTP và tài liệu đích không bao giờ nạp (khung thành trang lỗi, không request nào tới đích), **nhưng Chrome vẫn mở một kết nối TCP tới đích trước khi chính sách từ chối, tức đã phân giải tên miền đích**. Tên miền chứa được dữ liệu (`<bí-mật>.attacker.com`), khoảng 250 byte mỗi khối. Navigation API không bắn sự kiện cho đích khác origin nên không chặn được từ trong trang.
  2. _`<link rel=prerender>` do script thêm_: Chrome gửi một GET tới URL đó trước khi MutationObserver kịp gỡ, bất kể CSP (kể cả `prefetch-src`). Dữ liệu nằm trong đường dẫn.
  3. `rel=preconnect` và `dns-prefetch`: **chưa đo được**; Chrome điều khiển bằng automation không thực hiện hai gợi ý này (kiểm bằng net log, có và không có các cờ tắt mạng nền), nên không có đối chứng. Được che bằng header `X-DNS-Prefetch-Control: off`, `<meta>` tương ứng, runner từ chối `<link>`, kiểm tĩnh; chưa có số đo.
  4. Khung `about:blank` tạo bằng script vẫn có thể tồn tại (có realm riêng), nên khoá WebRTC trong trang chỉ là lớp phụ; e2e đo rằng không có gói STUN nào đi ra, nhưng đó là kết quả của Chrome này.
- **Hệ quả thiết kế:** vì còn đường rò ở mức tên miền/GET mà trình duyệt không cho đóng, khối chỉ nên giữ dữ liệu nó đã tự có (mã do mô hình viết, thứ người dùng gõ trong khối). Đọc cụm từ đã lưu (`phrases.list`) và ghi (`phrases.save`) đều phải được người dùng đồng ý trong hộp thoại của host. Ghi nhận rủi ro còn lại: một khối bị tiêm lệnh có thể gửi ra ngoài ≈ 250 byte tên miền và một đường dẫn GET những gì nó đã có, sau khi người dùng đã cho phép đọc.

**Chưa kiểm:** WKWebView (Tauri; cờ giữ tắt cho Tauri tới khi kiểm) và Safari/Firefox, gồm cả việc các đường rò trên có tồn tại ở đó; `preconnect`/`dns-prefetch` thật (xem trên); header CSP của web trên một phản hồi thật (chỉ kiểm cấu hình `headers()` bằng test); runner trên domain thật qua HTTPS và domain đăng ký riêng; Chrome với cài đặt "Preload pages" tắt (có thể đóng đường 2); chạy với khoá Gemini thật để xem mô hình có tuân luật prompt v2 không. Review bảo mật bằng agent khác vẫn cần trước khi bật cờ (lần review lô 3 đầu tiên đã tạo các sửa ở trên; cần review lại).

## Hệ quả

- Lô 1 an toàn theo thiết kế vì không có đường chạy mã.
- Lớp 2 cần domain/DNS cho runner, spike Chrome + WKWebView và review bảo mật trước khi bật.
