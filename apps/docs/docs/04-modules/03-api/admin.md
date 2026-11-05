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
- Khối `beta` trong metrics: thời gian từ cài tới caption đầu (trung vị phút, theo người), họp/tuần/người, D1, D7, số phản hồi 30 ngày. Mỗi số `null` khi chưa đủ dữ liệu. Định nghĩa: D1 = tỉ lệ người đã mở app ≥ 2 ngày có `session_started` trong `[24h, 48h)` sau lần mở đầu; D7 = như vậy với `[7 ngày, 8 ngày)` cho người ≥ 8 ngày; UTC, cửa sổ tuyệt đối.
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
