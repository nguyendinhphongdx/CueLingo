# Review — w2-02-plans-quota

## Thay đổi so với plan

| Dấu         | File / hành vi                                       | Chi tiết (lý do nếu khác plan)                                                                                                                                                                                                                                        |
| ----------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 ADDED    | `services/api/src/modules/usage/`                    | Gói, counter, cổng hạn mức; `GET /v1/me/usage`, `PUT /v1/admin/plan`                                                                                                                                                                                                  |
| 🟢 ADDED    | `infra/db/migrations/20261114090000_plans_usage.sql` | `user_plans`, `usage_counters`, `sessions.debrief_skipped`; có `down`                                                                                                                                                                                                 |
| 🟢 ADDED    | `packages/shared/src/plans.ts`, `dto/usage.dto.ts`   | Bảng mặc định, `PlanLimitsEnvSchema` (dùng chung cho API và worker), mốc UTC+7                                                                                                                                                                                        |
| 🟢 ADDED    | `UsageMeter`, `UsageSummary` (`@cuelingo/ui`)        | Plan chỉ ghi `UsageMeter`. Khối "gói + 5 thanh" hiện ở cả web và desktop nên cũng đưa vào `ui` (luật 11)                                                                                                                                                              |
| 🟡 MODIFIED | `realtime.service.ts`                                | Cổng hạn mức: **một** truy vấn PK (`gate`) chạy song song với glossary; `isAdmin` chỉ kiểm một lần lúc `hello`; phần cộng giờ dịch nằm ngoài `translationQueue`, kèm `unsettledMs` để chặn đợt câu dồn. Bản đầu có khoảng 7 lượt DB nối tiếp mỗi câu, review bắt được |
| 🟡 MODIFIED | `core-sdk/realtime.ts`                               | Bỏ qua `type` lạ và message `usage` không đọc được, thay vì gọi `onError` (trước đây desktop sẽ dừng phiên)                                                                                                                                                           |
| 🟡 MODIFIED | `sessions.service.ts`, worker `stale-sessions`       | Giữ chỗ debrief trước khi xếp job; hết lượt thì ghi cờ, không xếp job                                                                                                                                                                                                 |
| 🟡 MODIFIED | `agent.service.ts`                                   | Free = 0 tin; Pro và Ultra có thêm trần theo tháng, ngoài trần ngày đang có                                                                                                                                                                                           |
| 🟡 MODIFIED | `infra/compose.tunnel.yml`                           | Truyền `PLAN_LIMITS` cho `api`; thêm `PLAN_LIMITS` và `ADMIN_EMAILS` cho `workers`. `infra/docker-compose.yml` không đổi vì không có service API                                                                                                                      |

**Docs đã cập nhật:**

- ADR 0022.
- `03-architecture`: data-model, security-privacy, realtime-pipeline.
- `04-modules/03-api`: `usage` (mới), realtime, transcribe, assist, agent, sessions, debrief, privacy, admin.
- `04-workers/stale-sessions`.
- `05-packages`: shared, core-sdk, ui.
- `02-web`: usage (mới), debrief, preferences.
- `01-desktop`: session-controller, overlay, settings, tauri-core.

## Tự review

Theo [checklist](../../05-engineering/conventions/code-review.md): - [x] Ranh giới & bảo mật · - [x] Hợp đồng · - [x] Kiến trúc · - [x] AI · - [x] Test · - [x] Docs · - [x] Phạm vi

```bash
pnpm verify      # xanh: 1767 test, typecheck, lint, check:deps (chạy ngoài sandbox)
pnpm docs:build  # xanh
pnpm test:int    # xanh với Node 23.8: 20 file, 68 test (SQL giữ chỗ chạy đồng thời, counter còn sau xoá dữ liệu, cascade, migration up/down)
```

Độ trễ truy vấn đo trên Postgres thật (Testcontainers, 200 vòng):

| Truy vấn | p50     | p95     |
| -------- | ------- | ------- |
| `gate`   | 0,23 ms | 0,32 ms |
| `add`    | 0,33 ms | 0,51 ms |

Chưa đo p95 đầu-cuối của caption so với mục tiêu 2,5 s.

### Đã chạy thật (2026-11-15)

API của nhánh chạy ở máy với DB dev, Gemini thật, `PLAN_LIMITS={"free":{"translation_ms":20000,"assist_daily":2,"debriefs":1,"cloud_stt_ms":5000}}`.

| Luồng                                                             | Kết quả                                                                                                                                                                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/me/usage` (Free)                                         | Đủ 5 mục. `resetsAt` của tháng là `2026-11-30T17:00Z` (00:00 ngày 1/12 giờ VN), của ngày là `2026-11-15T17:00Z`. Trợ lý: `limit 0`, `exhausted`                                                |
| Tra từ 3 lần (giới hạn 2)                                         | Lần 1–2 trả nghĩa thật; lần 3 trả `429 QUOTA_EXCEEDED` (`assist_daily`, `used 2/2`)                                                                                                            |
| WebSocket `?features=usage`, 4 câu `system` × 8 s (giới hạn 20 s) | Nhận `usage low`; câu 1–3 được dịch; sau câu 3 nhận `usage exhausted` (`24000/20000`, Q5 dịch nốt câu đã qua cổng); câu 4 không được dịch nhưng vẫn lưu (4 câu lưu, 3 bản dịch); socket vẫn mở |
| Hai cuộc họp liền nhau (giới hạn 1 debrief)                       | Họp 1: job debrief được xếp (`404 NOT_FOUND` chờ worker). Họp 2: `404 DEBRIEF_SKIPPED`; bấm tạo lại trả `429 QUOTA_EXCEEDED`; `debriefs 1/1 exhausted`                                         |
| Log API                                                           | Không có câu chữ cuộc họp hay từ tra; không có log cảnh báo hoặc lỗi                                                                                                                           |

**Chưa chạy thật:**

- App desktop, overlay và một cuộc gọi Zoom/Meet thật.
- Trang Cài đặt và trang debrief trên web trong trình duyệt.
- `PUT /v1/admin/plan` với tài khoản admin thật: dev token không được nhận ở route admin, nên route này chỉ có test.
- e2e Playwright.
- Hết hạn mức STT đám mây (họp tiếng Việt): chỉ có test.

## Cho người review — đọc theo thứ tự

| #   | File                                                                             | Soi gì                                                               |
| --- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | `infra/db/migrations/20261114090000_plans_usage.sql`                             | Chỉ thêm, có cascade, có `down`                                      |
| 2   | `packages/shared/src/plans.ts`                                                   | Mốc UTC+7, `quotaState`, `translationCostMs`, cách đọc `PLAN_LIMITS` |
| 3   | `services/api/src/modules/usage/usage.repository.ts`                             | SQL `gate`/`reserve` nguyên tử, lọc theo `user_id`                   |
| 4   | `services/api/src/modules/realtime/realtime.service.ts`                          | Cổng hạn mức ngoài đường nóng, `unsettledMs`, gửi `usage` một lần    |
| 5   | `services/api/src/modules/sessions/sessions.service.ts`, worker `stale-sessions` | Debrief bị bỏ, cờ `debrief_skipped`                                  |
| 6   | `packages/core-sdk/src/realtime.ts`                                              | Bỏ qua message lạ                                                    |
| 7   | `apps/desktop/src/session/session-controller.ts`                                 | `QUOTA_EXCEEDED` không thử lại, không dừng phiên                     |

## Lỗi tìm thấy khi review/test

| Lỗi                                                                          | Tìm ở            | Sửa                                                                     |
| ---------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------- |
| Đường dịch tốn khoảng 7 lượt DB nối tiếp mỗi câu, nằm trong hàng đợi tuần tự | code-reviewer 🔴 | `c63d5a6`: một truy vấn `gate`, `isAdmin` một lần, `add` ngoài hàng đợi |
| Message `usage` có metric lạ làm desktop dừng phiên                          | code-reviewer 🟡 | `dfab326`                                                               |
| Lỗi DB sau `end` để lại phiên không có debrief, không dấu vết                | code-reviewer 🟡 | `d1e258e`: log `sessionId`, ghi vào `sessions.md`                       |
| Worker báo `PLAN_LIMITS` sai không rõ khoá nào                               | code-reviewer 🟡 | `7241ac7`: dùng chung cách đọc ở `shared`                               |
| `markDebriefSkipped` không lọc theo `user_id`                                | code-reviewer 🟢 | `534e532`                                                               |
