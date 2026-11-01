---
title: Review
---

# Review — foundation (đang làm)

Cập nhật theo từng brief. **Đã chạy thật** nghĩa là chạy với Postgres thật trong Docker, không chỉ test với đối tượng giả.

## Kết quả theo AC

| AC   | Nội dung                                                        | Trạng thái   | Bằng chứng                                                                                                                                                          |
| ---- | --------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1  | Env sai/thiếu → dừng, báo tên biến                              | ✅           | `config.test.ts` (api, workers)                                                                                                                                     |
| AC2  | `db:migrate` tạo đủ bảng, `db:rollback` lùi được                | ✅ chạy thật | 14 bảng trên Postgres; `migrations.int.test.ts`                                                                                                                     |
| AC3  | Đăng nhập magic link → session → `userId`                       | ✅ chạy thật | `curl`: gửi link → mở link (302 + cookie) → `GET/POST /v1/glossary`; `auth.int.test.ts`. Google chưa thử (chưa có khoá)                                             |
| AC4  | Không session → 401                                             | ✅ chạy thật | `curl` 401; `auth.int.test.ts`                                                                                                                                      |
| AC5  | Ranh giới người dùng với Postgres thật                          | ✅           | `glossary.int.test.ts`                                                                                                                                              |
| AC6  | API gửi job, worker xử lý; `retention.sweep` chạy lại không đổi | ✅ chạy thật | `pnpm --filter @cuelingo/api enqueue retention.sweep` → `completed`; có audio quá hạn mà chưa có storage → `failed` có lỗi rõ; `retention.int.test.ts`              |
| AC7  | `/glossary` trên web (Next.js)                                  | ✅ chạy thật | Trình duyệt: `/` → `/login`, gửi magic link, mở link → `/glossary`, thêm, tải lại vẫn còn, xoá, thêm trùng hiện lỗi, đăng xuất → vào `/glossary` bị đưa về `/login` |
| AC8  | Desktop: overlay, ⌘⇧L, không lọt vào chia sẻ màn hình           | ⏳ B3        | —                                                                                                                                                                   |
| AC9  | Build image api + workers, không chứa `.env`                    | ✅ chạy thật | `docker build` cả hai; container chạy với DB thật (`/healthz` 200, `/v1/glossary` 401, worker đăng ký job); không có `.env` trong image                             |
| AC10 | CI chạy verify, docs, test:int, docker build                    | ⏳           | Workflow đã viết; chưa chạy trên GitHub (chưa có remote)                                                                                                            |

## Kết quả theo brief

| Brief             | Ai                        | Kết quả                                                                                                                                                                                                                         |
| ----------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1 API foundation | Claude                    | Xong và chạy thật. Lỗi tìm ra khi chạy thật: xem [bài học](../../05-engineering/scaffold/02-api-foundation.md#bài-học-khi-chạy-thật-2026-11-01)                                                                                 |
| B2 UI package     | Codex, Claude review chéo | Xong, merge. AC1–AC4 của brief đạt, 8 test. Chưa dùng trong app nào cho tới B5/B3                                                                                                                                               |
| B4 Worker         | Claude                    | Xong và chạy thật. Một lỗi do test bắt (`defineJob` ném đồng bộ), đã sửa                                                                                                                                                        |
| B5 Web            | Claude                    | Xong và chạy thật trong trình duyệt. Bốn lỗi chỉ lộ ra khi chạy thật (webpack/Turbopack, `@source`, CORS DELETE, thông báo lỗi): xem [bài học](../../05-engineering/scaffold/04-web-nextjs.md#bài-học-khi-chạy-thật-2026-11-01) |
| B3 Desktop        | —                         | Chưa làm (Codex không có mạng → cần cài sẵn crate Rust và dependency trước khi giao)                                                                                                                                            |

## Kiểm thử

- `pnpm verify`: xanh (49 test đơn vị). `pnpm --filter @cuelingo/web build` thành công.
- `pnpm test:int`: **10/10 xanh** (4 file) trên Node ≥ 22.19.
- Test integration tự dựng Postgres bằng Testcontainers; không phụ thuộc DB dev.

## Còn mở

- Google OAuth chưa thử với khoá thật. Thông báo lỗi tiếng Việt cho trường hợp trùng thuật ngữ mới được kiểm bằng test đơn vị (`errors.test.ts`), chưa nhìn lại trên trình duyệt sau khi sửa.
- Cookie session giữa hai origin khác nhau ở production (cookie domain) chưa cấu hình.
- Nhà cung cấp email cho magic link ở production (trước beta); object storage cho audio.
- Chưa thử CI trên GitHub.

## B3 Desktop (2026-11-01)

- Lead: khung Tauri 2 + Rust (cửa sổ, tray, ⌘⇧L/W/S, 5 command), `native.ts` parse Zod. Codex: toàn bộ UI React (13 test). Review chéo: 🟢 đúng phạm vi, không `invoke` ngoài `native.ts`; 🟡 level overlay chưa đồng bộ với main.
- ✅ `pnpm verify` (62 test), `cargo fmt/clippy -D warnings/test`, `tauri dev` khởi động không lỗi, `tauri build` ra `CueLingo.app` (11 MB).
- ⏳ AC8: chưa nhìn được cửa sổ (agent thiếu quyền Screen Recording) — cần bạn chạy `pnpm --filter @cuelingo/desktop tauri dev`, bấm ⌘⇧L, thử chia sẻ màn hình Zoom/Meet.
