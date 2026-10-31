# 0005 · Backend modular monolith + Postgres, event log là nguồn sự thật

**Trạng thái:** Accepted · 2026-10-31

## Quyết định
- `services/api`: một service Fastify, chia module rõ ràng (`src/modules/*`); module chỉ gọi nhau qua hàm export ở `index.ts`.
- `services/workers`: job nền qua pg-boss (dùng chính Postgres, không cần Kafka ở MVP).
- Postgres 16 + pgvector là DB duy nhất.
- Bảng `events` append-only là nguồn sự thật. Learner Model và chỉ số là dữ liệu tính ra, có thể tính lại (`learner-recompute`).

## Hệ quả
- Vận hành đơn giản cho team nhỏ. Chỉ tách microservice khi realtime cần scale riêng.
- Đổi thuật toán Learner Model không làm mất dữ liệu.
