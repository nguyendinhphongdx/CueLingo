# 0019 · Giao diện do AI sinh ra: thẻ JSON trước, HTML/JS trong hộp cát sau

**Trạng thái:** Accepted · 2026-11-05 (lớp 1 làm ở Lô 1; lớp 2 hoãn, cần ADR bổ sung khi triển khai)

## Bối cảnh

Người dùng muốn câu trả lời của AI là giao diện thật như ChatGPT, không chỉ Markdown. Chạy mã do AI sinh ra là rủi ro bảo mật lớn nhất của tính năng.

## Quyết định

- **Lớp 1 (Lô 1):** AI gọi tool `show_card({kind,data})`; `data` phải khớp union Zod `AgentCard` trong `@cuelingo/shared`. Web render bằng thành phần `@cuelingo/ui`. Không chạy mã lạ.
- **Markdown:** `react-markdown` + `remark-gfm`, không bật HTML thô, không tải ảnh ngoài (chặn kênh rò qua URL ảnh), link mở `rel="noopener noreferrer"`.
- **Lớp 2 (hoãn, sau cờ `AGENT_HTML_BLOCKS`, mặc định tắt):** HTML/JS chạy trong iframe `sandbox="allow-scripts"` (không `allow-same-origin`) nạp từ origin riêng, CSP bằng header HTTP (`connect-src 'none'`), watchdog, cầu nối postMessage có allowlist; thao tác ghi luôn cần xác nhận của host. Chi tiết xem [plan](../06-delivery/2026-11-05-ai-agent/02-plan.md) mục c.

## Hệ quả

- Lô 1 an toàn theo thiết kế vì không có đường chạy mã.
- Lớp 2 cần domain/DNS cho runner, spike Chrome + WKWebView và review bảo mật trước khi bật.
