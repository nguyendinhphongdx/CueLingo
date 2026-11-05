# 0018 · Agent harness: package `@cuelingo/agent`, SSE, plugin nội bộ

**Trạng thái:** Accepted · 2026-11-05 (chủ sản phẩm duyệt Lô 1 ở cổng PLAN của hồ sơ [ai-agent](../06-delivery/2026-11-05-ai-agent/02-plan.md))

## Bối cảnh

Trợ lý AI cần vòng lặp có công cụ (tra từ, lưu từ, hiện thẻ), nhìn thấy được "đang nghĩ", dừng được, và phải ghép thêm tính năng lúc chạy. Gateway AI hiện chỉ gọi một lần, không stream, không tool.

## Quyết định

- **Package `@cuelingo/agent`, không I/O.** Bốn phần tách riêng: `ModelPort` (một bước stream), `buildContext` (cắt theo ngân sách, giữ cặp call/result), `ToolRegistry`/`AgentPlugin`, `runTurn` (async generator, trần số bước, abort). Mọi phụ thuộc được tiêm vào; depcruise cấm import I/O.
- **Gateway chỉ có `chat()` một bước stream** và khai báo tool, không chạy tool. Vòng lặp nằm ở `@cuelingo/agent`, API nối plugin với repository.
- **Stream bằng HTTP POST trả `text/event-stream`** (không dùng WebSocket: kênh WS dành cho caption, [ADR 0012](./README.md)). Dừng = `AbortController`. Gửi bằng `reply.send(stream)` để CORS và auth vẫn chạy.
- **Plugin là module TS nội bộ**, import tĩnh, đăng ký/gỡ/bật/tắt lúc chạy. Interface viết theo hướng tương thích MCP (input là Zod/JSON Schema) để sau mở ra ngoài tiến trình. Plugin chỉ nhận facade đã gắn `userId` và đúng quyền khai báo. Lỗi plugin thành `tool_result{ok:false}`, không làm hỏng lượt.
- Không hiện suy luận thô của model; "đang nghĩ" gồm trạng thái và các bước công cụ.

## Hệ quả

- Khoá một lượt/hội thoại nằm trong tiến trình, đúng với một container ([ADR 0011](./README.md)); nợ khi scale ngang.
- Thêm công cụ hay plugin không sửa lõi; thay model chỉ đổi adapter.
- Proxy phải không buffer SSE (`X-Accel-Buffering: no`, không nén).
