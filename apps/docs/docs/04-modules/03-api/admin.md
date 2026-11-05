---
title: Admin metrics
---

# Admin metrics

> Code: `services/api/src/modules/admin/`

## Trách nhiệm

- Chặn truy cập bằng allowlist email `ADMIN_EMAILS`.
- Tổng hợp tín hiệu vận hành xuyên người dùng mà không trả thông tin định danh.

## Phạm vi MVP

- `GET /v1/admin/metrics`
- `isAdmin(userId)` cho module khác dùng chung allowlist (ví dụ [invites](./invites.md)).

## Interface

| Method | Path                | Kết quả                                               |
| ------ | ------------------- | ----------------------------------------------------- |
| GET    | `/v1/admin/metrics` | `AdminMetricsSchema`; `403` nếu email không được phép |

## Phụ thuộc

- Auth context cung cấp `userId`; repository tra email chỉ để kiểm quyền.
- `sessions`, `events`, `debriefs`, `review_logs`.

## Dữ liệu & sự kiện

- Chỉ đọc số tổng hợp. Không trả email, transcript hoặc payload event.
- Định nghĩa cửa sổ số liệu: [Quan sát hệ thống](../../05-engineering/observability.md#định-nghĩa-số-liệu).

## Câu hỏi mở

- Khi có nhiều admin hơn, có chuyển allowlist sang vai trò trong DB không?
