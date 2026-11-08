# Plan — api-tunnel

## 1. Bối cảnh code

- **Dockerfile đã có** cho `services/api` và `services/workers` (Node 24 slim, `turbo prune`, chạy bằng `tsx`, không có bước build, API `EXPOSE 4000`). Build từ gốc repo: `docker build -f services/api/Dockerfile .`.
- **Migration** dùng `dbmate` (`pnpm db:migrate`, thư mục `infra/db/migrations`), chạy được bằng ảnh `amacneil/dbmate`; hiện chưa có bước chạy migration trong cách triển khai nào.
- **`infra/docker-compose.yml`** chỉ phục vụ phát triển (Postgres `pgvector/pgvector:pg16`, Redis, sandbox-runner), công bố cổng ra máy. Không dùng cho production.
- **API:** `loadConfig` đọc biến bằng Zod; `WEB_ORIGIN` mặc định `http://localhost:3000`, `BETTER_AUTH_URL` mặc định `http://localhost:4000` (mặc định `localhost` là thứ AC5 cấm ở production). Better Auth dùng `baseURL = BETTER_AUTH_URL` và `trustedOrigins = [WEB_ORIGIN]`; CORS cho `WEB_ORIGIN` và các origin của app desktop (`tauri://localhost`...). `/healthz` đã có.
- **Worker** chỉ cần `DATABASE_URL` và `GEMINI_API_KEY`; dùng pg-boss trên Postgres, không cần Redis.
- Web đã chạy ở `https://cuelingo.tutorial-aws.com` và đọc `NEXT_PUBLIC_API_URL` lúc build (biến GitHub `CUELINGO_API_URL`).
- Tên miền: web `cuelingo.tutorial-aws.com`, API `api-cuelingo.tutorial-aws.com` — cùng site nên cookie phiên của API (`SameSite=Lax`) được gửi trong yêu cầu từ web.
- Máy chủ chạy sau Cloudflare Tunnel nên thấy mọi yêu cầu đến từ `cloudflared` qua HTTP; API cần biết giao thức gốc là HTTPS (proxy tin cậy) để đặt cookie `Secure` và dựng đúng URL.

## 2. Phương án

| #   | Phương án                                                                                                                                                                                  | Ưu                                                               | Nhược                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| A   | Một `infra/compose.tunnel.yml` (Postgres, `migrate` một lần, API, worker, `cloudflared`, sao lưu); **build ảnh ngay trên máy** từ Dockerfile có sẵn; script nhỏ `up/update/backup/restore` | Dùng nguyên văn trên Mac và VPS; không cần kho ảnh; ít phần thừa | Mỗi lần cập nhật phải build lại trên máy (vài phút); cần có mã nguồn trên máy chủ  |
| B   | Như A nhưng **kéo ảnh dựng sẵn** từ GitHub Container Registry, CI đẩy ảnh                                                                                                                  | Cập nhật nhanh, máy chủ không cần mã nguồn                       | Thêm workflow, token đọc ảnh, kho ảnh riêng tư; chưa cần cho 30–50 tester; làm sau |
| C   | Mỗi dịch vụ một Compose riêng                                                                                                                                                              | Tách bạch                                                        | Khó dựng một lệnh, mạng chung phức tạp, trái yêu cầu "một tệp dùng chung"          |

**Chọn: A.** B là bước nâng cấp khi chuyển sang VPS (đổi `build:` thành `image:`, không đụng phần còn lại). Không cần ADR mới: thực thi ADR-0011 ở quy mô beta; ghi một dòng hệ quả vào ADR-0011.

Mặc định cho câu hỏi mở (đổi được ở cổng này):

1. Sao lưu: container `pg_dump` hằng ngày vào thư mục `./backups` (volume bind ngoài ảnh), giữ 7 bản; hướng dẫn chép sang R2/S3 hoặc ổ ngoài là bước làm tay lúc đầu.
2. API ngừng khi Mac tắt: chấp nhận ở giai đoạn đầu; web và app báo "không kết nối được".
3. Email: dùng Resend, khoá do bạn tạo mới; `AGENT_ENABLED=false` cho tới khi mời tester; Google tắt ở beta.

| Tác động                            | Có?    | Chi tiết                                                                                                                        |
| ----------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| DB migration                        | Không  | Không thêm bảng; chỉ thêm cách chạy migration có sẵn                                                                            |
| Contract (`@cuelingo/shared`)       | Không  |                                                                                                                                 |
| Event / Learner Model               | Không  |                                                                                                                                 |
| Prompt / model AI                   | Không  |                                                                                                                                 |
| Quyền riêng tư / dữ liệu người dùng | **Có** | Dữ liệu người dùng nằm trên máy cá nhân, bản sao lưu chứa dữ liệu thật, secret trong `.env`; không công bố cổng; ghi trong docs |

**Không đụng môi trường dev (chủ sản phẩm yêu cầu):** bản tunnel không dùng cổng mặc định nào của máy. Mặc định **không công bố cổng nào** (API, Postgres chỉ nằm trong mạng Compose; `cloudflared` gọi `http://api:4000` qua mạng nội bộ), nên `pnpm dev` vẫn dùng 4000/3000/5432 như cũ. Thêm: `name: cuelingo-tunnel` (tên project, mạng, volume tách khỏi `infra/docker-compose.yml` của dev), volume riêng `cuelingo-tunnel-pgdata`. Khi cần soi từ máy (psql, curl) có tệp ghi đè tuỳ chọn `infra/compose.tunnel.debug.yml` chỉ gắn `127.0.0.1:14000` (API) và `127.0.0.1:15432` (Postgres), không bật mặc định.

## 3. Các bước (mỗi bước ≈ 1 commit)

| #   | Bước                                                                                                                                                                                                                                                                                                                                                                                             | File                                                                  | Điểm mở rộng |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------ |
| 1   | `compose.tunnel.yml`: Postgres (volume, healthcheck), `migrate` (dbmate, chạy một lần), `api` (chờ migrate xong), `workers`, `cloudflared` (token từ `.env`); mạng nội bộ, **không `ports:`**, `name: cuelingo-tunnel`, volume riêng, thêm `compose.tunnel.debug.yml` (chỉ 127.0.0.1:14000/15432); `restart: unless-stopped`; `.env.tunnel.example` không chứa giá trị thật (AC1, 2, 3, 4, 6, 8) | `infra/compose.tunnel.yml`, `infra/.env.tunnel.example`, `.gitignore` | Hạ tầng      |
| 2   | Cứng hoá cấu hình production API: thiếu `WEB_ORIGIN`/`BETTER_AUTH_URL`/`BETTER_AUTH_SECRET`/`MAIL_PROVIDER≠console`... thì dừng, báo rõ; tin `X-Forwarded-*` từ proxy để cookie `Secure` và URL HTTPS đúng; kiểm CORS/cookie cho web và desktop; test (AC5, AC7, AC11)                                                                                                                           | `services/api/src/config.ts`, `app.ts`, test                          | API          |
| 3   | Sao lưu: dịch vụ `backup` (`pg_dump` hằng ngày, giữ 7 bản) + script khôi phục + thử khôi phục thật vào CSDL trống (AC10)                                                                                                                                                                                                                                                                         | `infra/compose.tunnel.yml`, `infra/tunnel/backup.sh`, `restore.sh`    | Hạ tầng      |
| 4   | Script vận hành: `up`, `down`, `logs`, `update` (kéo mã, build, migrate, khởi động lại, có bước quay lại bản trước), `status`; hướng dẫn chống ngủ trên Mac (AC9)                                                                                                                                                                                                                                | `infra/tunnel/*.sh`                                                   | Hạ tầng      |
| 5   | Docs tiếng Việt: trang vận hành (dựng, chạy, dừng, log, cập nhật, khôi phục, đổi tên miền, giới hạn của Mac cá nhân), H1–H3 từng bước (Tunnel, khoá, sao lưu), cập nhật ADR-0011; `pnpm verify`, `pnpm docs:build` (AC14)                                                                                                                                                                        | `apps/docs/docs/04-modules/**`, `08-adr/0011-*.md`                    | Docs         |
| 6   | **Chạy thật** với Docker Desktop: `docker compose config`, dựng toàn bộ trừ `cloudflared` nếu chưa có token, `migrate` thành công, `/healthz` trong mạng Compose, worker log đủ 5 việc, thử `down/up` và khôi phục sao lưu; điền `03-review.md` (AC1–3, 6, 8, 10) — phần qua Tunnel thật (AC3, 7, 12, 13) làm cùng bạn sau H1                                                                    | `03-review.md`                                                        | —            |

## 4. Rủi ro

| Rủi ro                                                            | Giảm thiểu                                                                                                           |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Docker Desktop trên máy này chưa chạy, colima lỗi                 | Bạn bật Docker Desktop; nếu không được thì bước 6 chỉ kiểm `compose config` và ghi rõ chưa chạy thật                 |
| Mac ngủ/tắt làm API rớt                                           | Hướng dẫn chống ngủ; web/app đã báo lỗi kết nối; ghi giới hạn trong docs                                             |
| Cookie phiên không giữ qua web ↔ API do `Secure`/proxy/`SameSite` | Bước 2 kiểm bằng test và thử thật qua Tunnel; tên miền con cùng site giúp cookie Lax đi cùng yêu cầu                 |
| WebSocket caption hoặc SSE bị cắt khi qua Cloudflare              | Thử thật qua Tunnel sau H1; ghi giới hạn nếu có                                                                      |
| Mất dữ liệu khi hỏng ổ/mất máy                                    | Sao lưu hằng ngày ra ngoài ảnh; hướng dẫn chép ra nơi khác; thử khôi phục thật ở bước 6                              |
| Rò secret (`.env`, token Tunnel, log, ảnh)                        | `.env` ngoài git, quyền chỉ chủ sở hữu, không đưa secret vào ảnh Docker; quét repo/log; khoá cũ đã lộ phải xoay (H2) |
| Migration hỏng giữa chừng khi cập nhật                            | `migrate` chạy trước API; script `update` sao lưu trước và có lệnh quay lại; thử up/down ở bước 6                    |

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                          |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------ |
| 2026-11-08 | Plan | Trình phương án A (một Compose, build ảnh tại máy); B (kéo ảnh từ GHCR) để dành khi lên VPS; C bị loại |
