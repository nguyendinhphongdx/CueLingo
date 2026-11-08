# Review — api-tunnel

## Thay đổi so với plan

| Dấu         | File / hành vi                                                                | Chi tiết (lý do nếu khác plan)                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 🟢 ADDED    | `infra/compose.tunnel.yml`, `compose.tunnel.debug.yml`, `.env.tunnel.example` | Postgres, migrate một lần, API, workers, cloudflared, backup. Không `ports:`; project/volume riêng; debug chỉ 127.0.0.1:14000/15432                          |
| 🟢 ADDED    | `infra/tunnel/tunnel.sh`, `backup.sh`                                         | up/down/status/logs/backup/update/restore/awake; từ chối chạy nếu `.env.tunnel` quyền rộng hơn 600                                                           |
| 🟡 MODIFIED | `services/api/src/config.ts`                                                  | Production bắt buộc `WEB_ORIGIN`, `BETTER_AUTH_URL`, phải là https và không phải localhost. Hai test cũ (production) phải thêm hai địa chỉ                   |
| 🟡 MODIFIED | `services/api/src/app.ts`                                                     | `trustProxy` bật khi `secureCookies` (production). Đúng vì API không có cổng công bố, chỉ cloudflared tới được. Soi kỹ nếu chạy API có cổng mở ra ngoài      |
| 🟡 MODIFIED | `.dockerignore`, `.gitignore`                                                 | Thêm `**/target` (lần build đầu gửi >2 GB vì thư mục Rust), `infra/backups`; cho phép commit `.env.tunnel.example`                                           |
| 🟢 ADDED    | `04-modules/03-api/deploy-tunnel.md`, dòng hệ quả ở ADR-0011                  | Hướng dẫn vận hành tiếng Việt                                                                                                                                |
| Lệch plan   | AC8                                                                           | Worker trong mã chỉ có 3 việc (`debrief.generate`, `retention.sweep`, `sessions.close-stale`), spec ghi 5 là sai; đã sửa spec. Public Hostname là `api:4000` |

**Docs đã cập nhật:** deploy-tunnel.md, ADR-0011, 01-specs.md (AC8).

## Tự review

Theo [checklist](../../05-engineering/conventions/code-review.md): ✅ Ranh giới & bảo mật (không cổng, secret chỉ trong `.env.tunnel`) · n/a Hợp đồng · ✅ Kiến trúc · n/a AI · ✅ Test (config production, 4 ca mới) · ✅ Docs · ✅ Phạm vi

```bash
pnpm verify   # xanh: 212 file, 1637 test
```

**Đã chạy thật** (Docker Desktop, giá trị giả, không có cloudflared): build 2 ảnh, postgres khoẻ, migrate áp dụng đủ migration rồi thoát 0, API `healthy` và `/healthz` trả `{"ok":true}`, worker đăng ký 3 việc, `docker ps` không có cổng công bố ra máy, backup tự tạo file `.dump`, thử khôi phục: dữ liệu quay về đúng thời điểm sao lưu (1 dòng thay vì 2), dừng và dọn sạch.

**Chưa chạy / chưa kiểm:**

- Qua Cloudflare Tunnel thật (cần H1): AC3 (HTTPS), AC7 (cookie/CORS thật, đăng nhập link email), AC12 (WebSocket caption, SSE), AC13 (app/web khi API tắt).
- AC2 khởi động lại Mac, AC9 chống ngủ, `tunnel.sh update` và `restore` đầu cuối (chỉ thử các lệnh thành phần, chưa chạy qua script); `pnpm docs:build` chưa chạy.
- Gửi email thật (Resend) và Gemini thật chưa thử.

## Cho người review — đọc theo thứ tự

| #   | File                         | Soi gì                                                                       |
| --- | ---------------------------- | ---------------------------------------------------------------------------- |
| 1   | `infra/compose.tunnel.yml`   | Không `ports:`, thứ tự phụ thuộc, secret lấy từ biến, volume                 |
| 2   | `services/api/src/config.ts` | Quy tắc production; `app.ts` `trustProxy`                                    |
| 3   | `infra/tunnel/tunnel.sh`     | `restore` xoá CSDL (có hỏi `yes`), `update` sao lưu trước, kiểm quyền `.env` |
| 4   | `deploy-tunnel.md`           | Các bước H1–H3 đủ rõ cho người không rành                                    |

## Lỗi tìm thấy khi review/test

- Build context gửi hơn 2 GB: thiếu `**/target` trong `.dockerignore` (đã sửa).
- Hai test cũ gãy khi production bắt buộc địa chỉ (đã sửa test).
- Spec nói worker có 5 việc, thực tế 3 (đã sửa spec).
