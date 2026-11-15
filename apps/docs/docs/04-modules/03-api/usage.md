---
title: Gói và hạn mức
---

# Gói và hạn mức (usage)

> Phần: [API service](./README.md) · Code: `services/api/src/modules/usage/` · Spec: `06-delivery/2026-11-14-w2-02-plans-quota` · [ADR 0022](../../08-adr/0022-usage-survives-data-delete.md)

Gán gói Free/Pro/Ultra cho từng người, đếm lượng dùng theo kỳ và là cổng chặn khi hết hạn mức. Chưa có thanh toán: admin gán gói tay.

## Trách nhiệm

- Lưu gói (`user_plans`; không có dòng = `free`) và lượng dùng (`usage_counters`, chỉ con số).
- Cho module khác một cổng duy nhất (`UsageService`): `status`, `tryReserve`/`reserve`, `add`, `snapshot`.
- Hạn mức mặc định ở `packages/shared/src/plans.ts`, ghi đè bằng biến môi trường `PLAN_LIMITS` (JSON, Zod kiểm lúc khởi động).
- Admin (`ADMIN_EMAILS`) có `limit: null` ở mọi mục nhưng vẫn được đếm.

## Interface

| Method | Path             | Ai gọi       | Kết quả                                                                                                                                                                                 |
| ------ | ---------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/me/usage`   | đã đăng nhập | `UsageResponseSchema`: `{plan, usage:{translation_ms, cloud_stt_ms, debriefs, assist_daily, agent_messages}}`, mỗi mục `{used, limit \| null, resetsAt, state: ok \| low \| exhausted}` |
| PUT    | `/v1/admin/plan` | admin        | Body `SetPlanRequestSchema` `{email, plan}` → `{email, plan}`; `403` không phải admin, `404` email không có, `400` gói lạ                                                               |

Hết hạn mức: `429` mã `QUOTA_EXCEEDED`, `details` = `QuotaExceededDetailsSchema` `{metric, plan, used, limit, resetsAt}`.

## Hạn mức và kỳ

| Metric           | Đơn vị    | Kỳ         | Nơi đếm                                                                             |
| ---------------- | --------- | ---------- | ----------------------------------------------------------------------------------- |
| `translation_ms` | mili giây | tháng (VN) | [realtime](./realtime.md): sau khi dịch xong một câu `system`                       |
| `cloud_stt_ms`   | mili giây | tháng (VN) | [transcribe](./transcribe.md): theo số byte âm thanh thật                           |
| `debriefs`       | số lần    | tháng (VN) | [sessions](./sessions.md), [worker stale-sessions](../04-workers/stale-sessions.md) |
| `assist_daily`   | số lần    | ngày (VN)  | [assist](./assist.md): `lookup`, `recap`, `compose` chung bộ đếm                    |
| `agent_messages` | số lần    | tháng (VN) | [agent](./agent.md): sau trần ngày; Free = 0                                        |

Mốc kỳ là 00:00 giờ Việt Nam (UTC+7). `low` khi còn ≤ 10 phút dịch hoặc ≤ 10% hạn mức khác.

## Giữ chỗ nguyên tử

Hạn mức đếm theo lượt dùng một câu SQL, nên hai request cùng lúc không lấy chung lượt cuối:

```sql
INSERT INTO usage_counters (user_id, period_start, metric, amount) VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id, period_start, metric)
DO UPDATE SET amount = usage_counters.amount + EXCLUDED.amount
WHERE usage_counters.amount < $5   -- limit
RETURNING amount
```

Không có dòng trả về nghĩa là bị từ chối. Giờ dịch thì kiểm trước (`status`) rồi cộng sau (`add`), nên có thể vượt tối đa khoảng một câu.

## Dữ liệu & quyền riêng tư

- Chỉ số và `user_id`; không log nội dung. Log đổi gói chỉ ghi `userId` của admin và `plan`.
- `DELETE /v1/me/data` không xoá counter và gói; xoá tài khoản thì xoá (cascade). Không có trong `GET /v1/me/export`.

## Test

`usage.test.ts` (đọc lượng dùng, ranh giới người dùng, admin không giới hạn), `plans.test.ts` (gói mặc định, admin đổi gói, cổng hạn mức, chạy đua), `test/integration/usage.int.test.ts` (SQL thật).
