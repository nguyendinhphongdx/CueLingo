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
- `GET`/`PATCH /v1/admin/agent`: công tắc toàn cục của trợ lý AI và bật/tắt từng plugin (ai-agent lô 2).
- `isAdmin(userId)` cho module khác dùng chung allowlist (ví dụ [invites](./invites.md)).

## Interface

| Method | Path                | Kết quả                                                                                                                                                                                                                                                                                                                         |
| ------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/admin/metrics` | `AdminMetricsSchema`; `403` nếu email không được phép                                                                                                                                                                                                                                                                           |
| GET    | `/v1/admin/agent`   | `AdminAgentStatusSchema`: `enabled` (công tắc admin), `available` (deploy có cho phép: `AGENT_ENABLED` và khoá AI), `plugins[]` (`id`, `version`, `state`, `permissions`, `tools`, `disabledBy?`, `retryAt?`); `403` nếu không phải admin. Khi module agent không được cấu hình: `{enabled:false, available:false, plugins:[]}` |
| PATCH  | `/v1/admin/agent`   | Body `UpdateAdminAgentRequest`: **hoặc** `{enabled}` (công tắc toàn cục) **hoặc** `{plugin:{id, enabled}}`; trả `AdminAgentStatus` mới. `400` nếu thiếu/đủ cả hai, `404` nếu plugin không có hoặc module agent không cấu hình, `403` nếu không phải admin                                                                       |

**Công tắc trợ lý.** Giữ trong bộ nhớ của tiến trình API (một container, [ADR 0011](../../08-adr/0011-deployment-containers-sg.md)): khởi động lại thì về bật. Hiệu lực khi `AGENT_ENABLED` **và** công tắc admin cùng bật; tắt thì mọi lượt mới nhận `503 AGENT_DISABLED`, lượt đang chạy không bị cắt. Tắt một plugin làm công cụ của nó biến khỏi danh sách gửi mô hình từ lượt kế tiếp; plugin `failed` (setup lỗi) không bật lại được từ đây. Chi tiết trạng thái và cầu dao: [packages/agent](../05-packages/agent.md#trách-nhiệm). Module admin chỉ giữ cổng `AgentAdminPort`; `app.ts` nối nó với `modules/agent`.

## Phụ thuộc

- Auth context cung cấp `userId`; repository tra email chỉ để kiểm quyền.
- `sessions`, `events`, `debriefs`, `review_logs`.

## Dữ liệu & sự kiện

- Chỉ đọc số tổng hợp. Không trả email, transcript hoặc payload event.
- Định nghĩa cửa sổ số liệu: [Quan sát hệ thống](../../05-engineering/observability.md#định-nghĩa-số-liệu).

## Câu hỏi mở

- Khi có nhiều admin hơn, có chuyển allowlist sang vai trò trong DB không?
