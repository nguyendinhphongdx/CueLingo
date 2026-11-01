# 0012 · Đường realtime: WebSocket trực tiếp ở M1, Centrifugo cho pub/sub về sau

**Trạng thái:** Accepted · 2026-11-01

## Bối cảnh

Caption M1 là luồng 1 client ↔ 1 phiên, hỏi–đáp có thứ tự (gửi câu final, nhận bản dịch). Centrifugo (Apache-2.0) cung cấp sẵn kết nối, xác thực JWT, phục hồi tin, presence và mở rộng nhiều node, nhưng là một service phải vận hành và là mô hình pub/sub.

## Quyết định

- **M1–M2:** `api/realtime` là WebSocket Fastify trực tiếp, dùng hợp đồng `@cuelingo/shared/ws` và client `@cuelingo/core-sdk` (đã có test). Ít hop nhất cho đường nhạy độ trễ.
- **Từ M3:** dùng Centrifugo cho các luồng pub/sub: báo "debrief xong", đồng bộ cài đặt nhiều thiết bị, mobile, web nhận cập nhật. API publish qua HTTP API của Centrifugo; client dùng `centrifuge-js`.
- Đường caption chỉ chuyển sang Centrifugo nếu cần mở rộng nhiều node hoặc replay tin nhắn; lúc đó chỉ đổi transport phía `core-sdk`, hợp đồng giữ nguyên.

## Phương án đã cân nhắc

- **Centrifugo ngay từ M1 (RPC proxy):** ít code server hơn nhưng thêm service, JWT, endpoint proxy và viết lại client; lợi ích chưa dùng tới ở M1.
- **Socket.IO / SSE:** không có lợi thế so với WebSocket thuần cho luồng này.

## Hệ quả

- Thêm Centrifugo vào `infra/docker-compose.yml` khi bắt đầu M3.
