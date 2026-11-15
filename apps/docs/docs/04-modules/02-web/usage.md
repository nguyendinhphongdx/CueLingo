# Usage

> Phần: [Web app](./README.md) · Code: `apps/web/src/features/usage/` · Spec: `06-delivery/2026-11-14-w2-02-plans-quota` (AC11)

Khối "Gói và lượng dùng" trong `/settings`: tên gói (Free/Pro/Ultra) và một `UsageMeter` cho mỗi hạn mức.

## Interface

| Thành phần       | Vai trò                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `UsagePanel`     | Container: `useUsage()` gọi `client.usage.get()` (`GET /v1/me/usage`), truyền cho view                             |
| `UsagePanelView` | Thuần: tên gói, 5 meter theo `USAGE_METRICS`, trạng thái đang tải và lỗi (`describeError`)                         |
| `UsageMeter`     | Ở `@cuelingo/ui` ([ui.md](../05-packages/ui.md#usagemeter)): nhãn, thanh, "Còn X", màu theo `ok / low / exhausted` |

## Lỗi hết hạn mức

`describeError` (`src/lib/errors.ts`) hiểu `QUOTA_EXCEEDED` qua `details` (`QuotaExceededDetailsSchema`): nói hạn mức nào đã hết và ngày làm mới ("Ngày mai" với `assist_daily`). `describeRegenerateError` cũng vậy (không nhầm với "bấm hơi nhanh"). `describeAgentError` phân biệt `AGENT_QUOTA_EXCEEDED`: gói Free (không có `monthly`) → "Gói Free chưa có trợ lý AI…", hết tin tháng → nêu số tin và ngày làm mới, còn lại là trần ngày như trước. Lời nhắn chung cho web và desktop nằm ở `@cuelingo/ui/lib/usage`.

## Phụ thuộc

- `@cuelingo/shared` (`UsageResponse`, `USAGE_METRICS`), `@cuelingo/core-sdk` (`client.usage`), TanStack Query
- Dữ liệu và quy tắc phía server: [usage (API)](../03-api/usage.md)

## Test

`UsagePanel.test.tsx` (tên gói, năm meter, trạng thái tải/lỗi), `lib/errors.test.ts` (thông báo hạn mức), `DebriefPage.test.tsx` (debrief bị bỏ không bị coi là "đang tạo").
