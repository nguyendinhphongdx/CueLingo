---
title: Gói và hạn mức
---

# Gói và hạn mức (usage)

> Phần: [API service](./README.md) · Code: `services/api/src/modules/usage/` · Spec: `06-delivery/2026-11-14-w2-02-plans-quota` · [ADR 0022](../../08-adr/0022-usage-survives-data-delete.md)

Gán gói Free/Pro/Ultra cho từng người, đếm lượng dùng theo kỳ và là cổng chặn khi hết hạn mức. Gói được nâng bằng thanh toán ([billing](./billing.md)) hoặc admin gán tay.

## Trách nhiệm

- Lưu gói (`user_plans`; không có dòng = `free`; `expires_at` và `source` = `manual` \| `payment`) và lượng dùng (`usage_counters`, chỉ con số).
- Cho module khác một cổng duy nhất (`UsageService`): `status`, `tryReserve`/`reserve`, `add`, `snapshot`. Module này **không còn ghi `user_plans` khi admin đổi gói**: `PUT /v1/admin/plan` tìm người theo email rồi gọi `options.grant` (là `billing.service.grantByAdmin`, nối trong `app.ts`), vì đổi gói giờ ghi cả đơn 0đ trong cùng transaction ([billing](./billing.md)).
- Hạn mức mặc định ở `packages/shared/src/plans.ts`, ghi đè bằng biến môi trường `PLAN_LIMITS` (JSON, Zod kiểm lúc khởi động).
- Admin (`ADMIN_EMAILS`) có `limit: null` ở mọi mục nhưng vẫn được đếm.

## Interface

| Method | Path             | Ai gọi       | Kết quả                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ---------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/v1/me/usage`   | đã đăng nhập | `UsageResponseSchema`: `{plan, usage:{translation_ms, cloud_stt_ms, debriefs, assist_daily, agent_messages}}`, mỗi mục `{used, limit \| null, resetsAt, state: ok \| low \| exhausted}`                                                                                                                                                                                                                                                                                                         |
| PUT    | `/v1/admin/plan` | admin        | Body `SetPlanRequestSchema` `{email, plan, period?}` **strict**: `period` (`month` \| `year`) bắt buộc với Pro/Ultra, không có với Free → `{email, plan, expiresAt?}` (hạn do server tính); `403` không phải admin, `404` email không có, `400` gói lạ, thiếu/thừa `period` hoặc còn gửi `expiresAt`. **Thay đổi phá vỡ** (route chỉ admin): `expiresAt` trong body đã bỏ. Hạ gói được phép. Dòng cũ không hạn (`source='manual'`, `expires_at` NULL) vẫn có hiệu lực mãi cho đến khi admin đổi |

Hết hạn mức: `429` mã `QUOTA_EXCEEDED`, `details` = `QuotaExceededDetailsSchema` `{metric, plan, used, limit, resetsAt}`.

## Hết hạn gói

Gói trả phí có `expires_at`. Hết hạn được tính **lúc đọc**: `expires_at <= now` thì coi là `free` ở `snapshot` và `gate` (API) và ở câu SQL của worker [stale-sessions](../04-workers/stale-sessions.md). Không có job nền hạ gói và không xoá gì; lượng dùng trong tháng giữ nguyên, khi lên gói giữa tháng thì áp hạn mức mới lên số đã dùng. Người dùng xem ngày hết hạn qua `GET /v1/billing`; `UsageResponse` không đổi (strict).

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

Không có dòng trả về nghĩa là bị từ chối. Trước đó, cổng đọc gói và counter của đúng một metric bằng một câu theo khoá chính (`gate`), song song với việc kiểm admin; `GET /v1/me/usage` mới đọc đủ cả năm mục (`snapshot`).

**Có thể vượt tối đa một phần việc.** Giữ chỗ chỉ kiểm "đã chạm trần chưa" rồi cộng cả `amount`, nên lượt cuối có thể vượt trần đúng bằng một phần: một câu dịch (tối đa 60 giây), một đoạn STT (tối đa 25,5 giây) hoặc một lượt. Không chặn lượt đó vì từ chối sau khi người dùng đã nói thì tệ hơn. Giờ dịch thì kiểm trước (`status`) rồi cộng sau (`add`), nên có thể vượt tối đa khoảng một câu.

## Dữ liệu & quyền riêng tư

- Chỉ số và `user_id`; không log nội dung. Dòng `plan changed` (audit đổi gói) do billing ghi, xem [billing](./billing.md). `set_by` giữ người đổi gần nhất.
- `DELETE /v1/me/data` không xoá counter và gói; xoá tài khoản thì xoá (cascade). Không có trong `GET /v1/me/export`.

## Test

`usage.test.ts` (đọc lượng dùng, ranh giới người dùng, admin không giới hạn), `plans.test.ts` (gói mặc định, admin đổi gói theo `period` (hạn tính ở server), log đổi gói, gói trả phí hết hạn, cổng hạn mức, chạy đua), `test/integration/usage.int.test.ts` (SQL thật).

## Hạn mức bài học theo mục tiêu

Hai metric mới theo ngày (kỳ reset giờ Việt Nam): `lessons_daily` (Free 2, Pro 10, Ultra 20) và `lesson_practice_daily` (Free 20, Pro 150, Ultra 300). Tổng số metric là 7; `isDailyMetric` nhận mọi metric kết thúc bằng `_daily`. Module goals kiểm bằng `status` trước và cộng bằng `add` sau khi thành công, nên lỗi AI không bị tính. Ràng buộc `usage_counters_metric_check` được thay bằng danh sách 7 metric trong migration `20261122090000_goal_lessons`. Xem [goals](./goals.md).
