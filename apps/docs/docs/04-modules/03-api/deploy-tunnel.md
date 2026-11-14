# Vận hành API sau Cloudflare Tunnel

> Phần: [API](./README.md) · Code: `infra/compose.tunnel.yml`, `infra/compose.tunnel.debug.yml`, `infra/.env.tunnel.example`, `infra/tunnel/` · Hồ sơ: [api-tunnel](../../06-delivery/2026-11-08-api-tunnel/02-plan.md) · Quyết định: [ADR 0011](../../08-adr/0011-deployment-containers-sg.md)

API, worker và Postgres chạy bằng **một tệp Docker Compose** trên một máy (giai đoạn đầu là máy Mac của chủ sản phẩm). `cloudflared` nối ra Cloudflare, nên API có địa chỉ công khai HTTPS mà **không mở cổng nào** trên máy. Web (Cloudflare Pages) và app desktop chỉ biết địa chỉ API (ví dụ `https://api-cuelingo.<tên-miền>`); chuyển sang VPS chỉ là chạy lại đúng tệp này ở máy mới, web và app không phải đổi.

## Thành phần

| Dịch vụ       | Việc                                                                                    |
| ------------- | --------------------------------------------------------------------------------------- |
| `postgres`    | pgvector/pg16, dữ liệu ở volume `cuelingo-tunnel-pgdata`                                |
| `migrate`     | chạy migration (dbmate) một lần rồi thoát; API và worker chỉ chạy sau khi nó thành công |
| `api`         | Fastify, kiểm sức khoẻ ở `/healthz`                                                     |
| `workers`     | pg-boss: `debrief.generate`, `retention.sweep`, `sessions.close-stale`                  |
| `cloudflared` | đường duy nhất ra ngoài; chỉ chạy khi `api` khoẻ                                        |
| `backup`      | `pg_dump` hằng ngày vào `BACKUP_DIR`, giữ `BACKUP_KEEP` bản (mặc định 7)                |

Không dịch vụ nào công bố cổng ra máy, nên `pnpm dev` (3000, 4000, 5432) không bị ảnh hưởng. Muốn xem từ máy: thêm `infra/compose.tunnel.debug.yml` (chỉ `127.0.0.1:14000` cho API, `127.0.0.1:15432` cho Postgres).

## Dựng lần đầu

Việc **bạn** làm (không ai làm thay được, và đừng dán giá trị vào chat):

1. **Tạo tunnel (H1).** Cloudflare → Zero Trust → Networks → Tunnels → Create → Cloudflared. Lấy token. Thêm Public Hostname: tên miền con của API (ví dụ `api-cuelingo.<tên-miền>`), Service `HTTP`, URL **`http://api:4000`** (tên dịch vụ trong Compose, không phải `localhost`; giao diện mới yêu cầu có `http://`).
2. **Tạo khoá (H2).** `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `POSTGRES_PASSWORD`, khoá Resend và Gemini **mới**; khoá cũ đã lộ phải thu hồi.
3. **Chọn nơi lưu sao lưu (H3).** `BACKUP_DIR` trỏ tới ổ khác hoặc thư mục đồng bộ nếu có.

Rồi:

```bash
cp infra/.env.tunnel.example infra/.env.tunnel
chmod 600 infra/.env.tunnel
# mở infra/.env.tunnel và điền
infra/tunnel/tunnel.sh up
```

Kiểm: `curl https://<địa-chỉ-API>/healthz` trả `{"ok":true}`. Sau đó đặt biến GitHub `CUELINGO_API_URL` bằng địa chỉ API và chạy lại workflow web để web gọi đúng API.

## Lệnh hằng ngày

| Việc                                             | Lệnh                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Chạy (build lại image khi code đổi)              | `infra/tunnel/tunnel.sh up`                                                         |
| Chỉ đổi `infra/.env.tunnel` (khoá, `MAIL_FROM`…) | `infra/tunnel/tunnel.sh reload`: không build, chỉ tạo lại container có cấu hình đổi |
| Dừng                                             | `infra/tunnel/tunnel.sh down` (dữ liệu giữ nguyên)                                  |
| Xem trạng thái / log                             | `infra/tunnel/tunnel.sh status` / `logs [dịch-vụ]`                                  |
| Sao lưu ngay                                     | `infra/tunnel/tunnel.sh backup`                                                     |
| Cập nhật bản mới                                 | `infra/tunnel/tunnel.sh update`                                                     |
| Khôi phục từ bản sao lưu                         | `infra/tunnel/tunnel.sh restore <tệp.dump>`                                         |

`update` sao lưu, kéo mã (`git pull --ff-only`), build lại, chạy migration rồi khởi động lại. Để quay lại bản trước: `git checkout <mã-in-ra-lúc-update>` rồi `up`; nếu migration đã đổi cấu trúc dữ liệu thì khôi phục bản sao lưu vừa tạo.

## Chạy trên Mac cá nhân: giới hạn và cách giảm

- **Mac ngủ, tắt, mất mạng hay đóng nắp = API ngừng.** Web và app báo "không kết nối được". Giữ máy thức: `infra/tunnel/tunnel.sh awake` (chạy `caffeinate`), hoặc Cài đặt hệ thống → Pin/Nguồn: chặn ngủ khi cắm sạc. Cắm sạc, đừng đóng nắp.
- **Tự chạy lại sau khi khởi động**: bật Docker Desktop → Settings → "Start Docker Desktop when you sign in"; mọi dịch vụ có `restart: unless-stopped`. Mac phải đăng nhập (không phải chỉ bật máy).
- **Dữ liệu người thử nằm trên máy cá nhân.** Sao lưu mặc định nằm cùng máy: nếu hỏng ổ là mất cả hai. Chép `BACKUP_DIR` ra nơi khác định kỳ.
- Đây là giải pháp tạm cho vài chục người thử. Khi cần ổn định hơn, chạy cùng tệp trên VPS (đổi `build:` thành ảnh dựng sẵn là tuỳ chọn).

## Cấu hình và bảo mật

- Mọi cấu hình nằm trong `infra/.env.tunnel` (ngoài git, quyền `600`; script từ chối chạy nếu quyền rộng hơn). Mẫu: `infra/.env.tunnel.example`.
- Production **từ chối khởi động** nếu thiếu `WEB_ORIGIN` / `BETTER_AUTH_URL`, nếu chúng không phải `https` hoặc là `localhost`, hoặc nếu `MAIL_PROVIDER=console`. Lỗi nêu đúng tên biến.
- CORS và cookie chỉ cho `WEB_ORIGIN` (và origin của app desktop). Web và API phải cùng tên miền gốc để cookie đăng nhập đi cùng yêu cầu.
- `AGENT_ENABLED=false` là mặc định: bật khi mời tester. `AGENT_HTML_BLOCKS` luôn tắt ở đây (xem [ADR 0019](../../08-adr/0019-ai-generated-ui.md)).
- Secret không nằm trong ảnh Docker hay repo; đừng dán `infra/.env.tunnel` hay token vào chat, issue, ảnh chụp.

## Đổi tên miền

Sửa `WEB_ORIGIN`, `BETTER_AUTH_URL` trong `infra/.env.tunnel`, đổi Public Hostname ở Cloudflare, rồi `tunnel.sh reload`. Phía web: biến GitHub `CUELINGO_API_URL`. Danh sách đầy đủ: [Deploy Cloudflare](../02-web/deploy-cloudflare.md).

## Khôi phục thử

Nên thử một lần trước khi cần thật: `tunnel.sh backup`, rồi `tunnel.sh restore infra/backups/cuelingo-manual-….dump` (yêu cầu gõ `yes`; dừng API trong lúc khôi phục).
