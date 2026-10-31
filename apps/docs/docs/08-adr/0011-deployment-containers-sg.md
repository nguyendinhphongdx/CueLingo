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
