# Stale sessions

> Phần: [Workers](./README.md) · Code: `services/workers/src/jobs/stale-sessions/`

Kết thúc các cuộc họp bị bỏ lửng ở trạng thái `live` (app tắt, khởi động lại hoặc lỗi giữa chừng) để chúng có debrief thay vì kẹt mãi.

## Trách nhiệm

- Chạy mỗi 10 phút (`*/10 * * * *`); tìm phiên `live` không có hoạt động trong 30 phút (hoạt động = thời điểm câu cuối kết thúc, hoặc lúc bắt đầu nếu chưa có câu nào)
- Đặt `status = 'ended'`, `ended_at` = lần hoạt động cuối
- Nếu có ít nhất một câu thì giữ chỗ một lượt `debriefs` của tháng cho chủ phiên rồi xếp job `debrief.generate` đúng như `POST /v1/sessions/:id/end` (cùng khoá chống trùng). Hết lượt thì chỉ đóng phiên và ghi `sessions.debrief_skipped = 'quota'` (không thì bỏ dở phiên là có debrief miễn phí). Phiên trống chỉ được đóng, không tốn lượt
- Kết quả trả về `{closed, queued, skipped}`
- Chạy lại không làm gì thêm (chỉ đổi các dòng còn `live`)

## Interface

- Job `sessions.close-stale`; hằng `STALE_SESSION_MINUTES` và `STALE_SWEEP_CRON` ở `stale-sessions.handler.ts`

## Cấu hình

Worker đọc cùng `PLAN_LIMITS` và `ADMIN_EMAILS` với API (cùng định dạng và cùng schema `PlanLimitsEnvSchema` trong `@cuelingo/shared`, nên sai là dừng ngay lúc khởi động và nêu đúng khoá; xem [usage](../03-api/usage.md)); `src/lib/usage.ts` dùng logic thuần của `@cuelingo/shared` và lặp lại đúng một câu SQL giữ chỗ vì worker không import API. Hai bên phải đặt giống nhau, nên `infra/compose.tunnel.yml` truyền cả hai biến cho cả hai service.

## Giới hạn

- Segment không có cột thời gian nên hoạt động tính bằng `started_at + max(end_ms)`; giả định `end_ms` đếm từ đầu phiên
- Nếu worker lỗi giữa lúc đóng phiên và xếp job thì phiên không tự có debrief; người dùng bấm "Tạo lại debrief"
