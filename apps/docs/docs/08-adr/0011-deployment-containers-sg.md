# 0011 · Triển khai: container + Postgres managed, region Singapore

**Trạng thái:** Accepted · 2026-10-31

## Bối cảnh

Người dùng ở Việt Nam, cần độ trễ mạng thấp cho dịch realtime. Team nhỏ, không muốn tự vận hành Kubernetes ở MVP. Dữ liệu cần ở một region rõ ràng để làm tài liệu pháp lý.

## Quyết định

- `services/api` và `services/workers` đóng gói thành **Docker image**, chạy trên một nền tảng container managed có region **Singapore**.
- **Postgres managed** (có pgvector và backup tự động) cùng region.
- Object storage S3-compatible cho audio (chỉ khi người dùng cho phép) và cache TTS.
- Web (Next.js) deploy cùng nền tảng hoặc nền tảng tối ưu cho Next.js. Docs build tĩnh.
- Chọn nhà cung cấp cụ thể ở tuần 10, trước beta, dựa trên chi phí, độ trễ tới Việt Nam và hợp đồng xử lý dữ liệu.

## Hệ quả

- Viết Dockerfile cho api/workers ở giai đoạn Nền móng (dùng `turbo prune`).
- Doanh nghiệp cần on-premise/VPC (giai đoạn Scale) dùng lại cùng image.
- Web (2026-11-08) lên **Cloudflare Pages** dưới dạng site tĩnh (`next build` xuất file, không cần runtime Node), deploy bằng GitHub Actions; API/workers/Postgres vẫn theo quyết định trên. Xem [Deploy Cloudflare](../04-modules/02-web/deploy-cloudflare.md).
- API/workers/Postgres giai đoạn beta (2026-11-08) chạy bằng **một Docker Compose** (`infra/compose.tunnel.yml`) trên máy Mac của chủ sản phẩm, ra Internet qua **Cloudflare Tunnel** (không mở cổng). Địa chỉ API gắn với tên miền chứ không gắn với máy, nên khi chuyển sang VPS chỉ chạy lại cùng tệp Compose, web và app không đổi. Xem [Vận hành API sau Cloudflare Tunnel](../04-modules/03-api/deploy-tunnel.md).
