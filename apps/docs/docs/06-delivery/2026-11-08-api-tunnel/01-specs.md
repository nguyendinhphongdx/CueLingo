# api-tunnel — Một Docker Compose cho API, worker, Postgres và Cloudflare Tunnel (chạy trên Mac, sau chuyển sang VPS)

| Trạng thái | Loại    | Nhánh / PR               | Ước lượng → thực tế |
| ---------- | ------- | ------------------------ | ------------------- |
| Spec       | feature | `feat/api-tunnel` / _PR_ | _0,5–1 ngày → ?_    |

**Phạm vi:** trong: **một tệp Docker Compose riêng cho môi trường tunnel** chạy Postgres (pgvector), API, worker và `cloudflared`, dùng giống hệt trên máy Mac hiện tại và trên VPS sau này; API ra Internet qua Cloudflare Tunnel ở `api-cuelingo.tutorial-aws.com` nên web (`cuelingo.tutorial-aws.com`) và app desktop không phải đổi gì khi chuyển máy; cấu hình production, tự khởi động lại, sao lưu, tài liệu vận hành · ngoài: máy chủ riêng 24/7, tự động triển khai từ GitHub, Postgres managed, Cloudflare Containers, runner hộp cát HTML.

## 1. Vấn đề

Web đã lên Cloudflare nhưng API chưa có nơi chạy công khai, nên chưa đăng nhập, lưu cụm từ, ôn tập hay dùng trợ lý được, và bản `.dmg` chưa dùng được. Chủ sản phẩm chọn tạm giai đoạn này **chạy ngay trên máy Mac đang dùng** bằng một bản Compose riêng, mở ra Internet qua Cloudflare Tunnel để web và app gọi vào; về sau chuyển sang VPS bằng đúng bản Compose đó, vì địa chỉ API gắn với tên miền (Tunnel) chứ không gắn với máy, nên phía web và app không đổi. Hệ quả cần quản lý: máy Mac có thể ngủ, tắt, mất mạng hoặc bị dùng cho việc khác, nên dịch vụ phải tự dựng lại và tester phải được báo khi API tạm ngừng.

- **Spec liên quan:** `08-adr/0011-deployment-containers-sg.md`, `03-architecture/08-security-privacy.md`, `04-modules/03-api/`, `04-modules/04-workers/`, `06-delivery/2026-11-08-web-cloudflare/`, `06-delivery/2026-11-08-server-picker/`
- **Module chạm tới:** `services/api`, `services/workers` (cấu hình, cách chạy), `infra/` (script và cấu hình mới), `apps/docs`

## 2. Tiêu chí chấp nhận (EARS)

| #    | AC                                                                                                                                                                                                                                           | Test                                        |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| AC1  | THE SYSTEM SHALL có một tệp Compose riêng (`infra/compose.tunnel.yml`) dựng và chạy Postgres (pgvector), API, worker và `cloudflared` bằng một lệnh, và một lệnh dừng; cùng tệp dùng được trên Mac và trên VPS Linux mà không sửa            | `docker compose config` + chạy thử trên Mac |
| AC2  | WHEN Mac khởi động lại hoặc người dùng đăng nhập lại THE SYSTEM SHALL tự chạy lại API, worker và đường hầm (Docker Desktop tự mở khi đăng nhập + `restart: unless-stopped`; trên VPS dùng dịch vụ Docker)                                    | khởi động lại thử                           |
| AC3  | WHEN gọi `https://api-cuelingo.tutorial-aws.com/healthz` THE SYSTEM SHALL trả 200 qua HTTPS, và không dịch vụ nào trong Compose công bố cổng ra máy chủ (API chỉ tới được qua mạng nội bộ Compose, `cloudflared` là đường duy nhất ra ngoài) | kiểm thật sau cấu hình (cần H1) + quét cổng |
| AC4  | THE SYSTEM SHALL cấu hình production từ một tệp `.env` riêng (secret ngoài git), có mẫu không chứa giá trị thật, gồm `WEB_ORIGIN`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `MAIL_*`, `GEMINI_API_KEY`, `AGENT_ENABLED=false`                | kiểm mẫu + quét repo không có secret        |
| AC5  | IF thiếu biến bắt buộc ở production THEN THE SYSTEM SHALL báo lỗi rõ ràng thay vì chạy với mặc định `localhost`                                                                                                                              | test cấu hình                               |
| AC6  | WHEN cập nhật bản mới THE SYSTEM SHALL chạy migration CSDL trước khi API nhận lưu lượng và có cách quay lại bản trước                                                                                                                        | kiểm migration up/down + hướng dẫn          |
| AC7  | THE SYSTEM SHALL chỉ cho web `https://cuelingo.tutorial-aws.com` gọi API kèm cookie (CORS và cookie đúng origin, `Secure`, `SameSite`), và đăng nhập bằng link email hoạt động                                                               | test CORS/cookie + kiểm thật                |
| AC8  | THE SYSTEM SHALL chạy worker với cùng `DATABASE_URL` và đăng ký đủ các việc đang có trong mã (debrief.generate, retention.sweep, sessions.close-stale)                                                                                       | log khởi động liệt kê các việc              |
| AC9  | WHILE chạy trên Mac THE SYSTEM SHALL có hướng dẫn và lệnh ngăn máy ngủ (`caffeinate`/cài đặt nguồn) để API không rớt khi không có ai thao tác                                                                                                | kiểm cài đặt nguồn                          |
| AC10 | THE SYSTEM SHALL sao lưu Postgres hằng ngày ra ngoài máy (hoặc ít nhất ra ổ khác), giữ ít nhất 7 bản, có hướng dẫn khôi phục đã thử                                                                                                          | script + thử khôi phục                      |
| AC11 | THE SYSTEM SHALL không để lộ secret trong log, ảnh Docker hay repo; token Tunnel và khoá chỉ nằm trong tệp `.env` trên Mac với quyền chỉ chủ sở hữu đọc                                                                                      | quét repo/log + kiểm quyền tệp              |
| AC12 | WHEN WebSocket caption và luồng SSE của trợ lý đi qua đường hầm THE SYSTEM SHALL hoạt động không bị cắt sớm                                                                                                                                  | thử thật qua Tunnel (cần H1)                |
| AC13 | WHEN API không tới được (Mac ngủ/tắt/mất mạng) THE SYSTEM SHALL để web và app báo "không kết nối được" bằng tiếng Việt thay vì lỗi trắng (đã có ở web; kiểm thêm ở app)                                                                      | kiểm thật khi tắt API                       |
| AC14 | THE SYSTEM SHALL có tài liệu vận hành tiếng Việt: dựng, chạy, dừng, xem log, cập nhật, khôi phục, đổi tên miền, và nêu rõ giới hạn của việc chạy trên Mac cá nhân                                                                            | docs build + rà soát                        |

## 3. Câu hỏi mở

- [x] Chạy bằng Docker (chủ sản phẩm chọn, 2026-11-08); Docker Desktop trên máy này cần được bật (hiện chưa chạy, colima không khởi động được).
- [ ] Sao lưu ra đâu (ổ ngoài, iCloud, hay R2/S3)?
- [ ] Gửi email đăng nhập bằng Resend: đã có khoá mới và tên miền gửi thư xác thực chưa?
- [ ] `GEMINI_API_KEY` mới và `AGENT_ENABLED=false` cho tới khi mời tester — đồng ý?
- [ ] Đăng nhập Google bật trong beta hay chưa?
- [ ] Chấp nhận việc API ngừng khi Mac tắt/ngủ trong giai đoạn đầu, hay cần máy riêng sớm hơn?

## Việc cần chủ sản phẩm làm (không tự làm được)

- **H1** Tạo Cloudflare Tunnel (Zero Trust → Networks → Tunnels), lấy token, đặt trên Mac; thêm Public Hostname `api-cuelingo.tutorial-aws.com` trỏ về `http://localhost:4000`.
- **H2** Tạo khoá mới và đặt vào `.env` trên Mac: Resend, Gemini, `BETTER_AUTH_SECRET` (chuỗi ngẫu nhiên ≥ 32 ký tự); xoay khoá cũ đã lộ.
- **H3** Chọn nơi lưu sao lưu và cấp quyền cho script.

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                                                                                                                                                     |
| ---------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-08 | Spec | Chủ sản phẩm chọn dùng Docker và một bản Compose riêng cho tunnel để sau chuyển sang VPS mà web/app không phải đổi. Mở hồ sơ. Chủ sản phẩm chọn tạm chạy trên máy Mac hiện tại + Cloudflare Tunnel (đính chính: không phải máy chủ riêng); loại Workers, Containers, dịch vụ thuê |
