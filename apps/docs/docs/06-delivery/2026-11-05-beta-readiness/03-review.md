# Review — beta-readiness

## Thay đổi so với plan

| Dấu         | File / hành vi                                                                                                           | Chi tiết                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 🟢 ADDED    | Mã mời: `invites` + `invite_redemptions`, module api `invites`, cổng `validateUserInfo`, trang admin, cookie `cl_invite` | AC1–5. Chỉ lưu SHA-256, dùng nguyên tử bằng `UPDATE … RETURNING`                           |
| 🟢 ADDED    | Phản hồi: bảng `feedback`, `POST /v1/feedback`, form dùng chung `@cuelingo/ui`, trang desktop và web                     | AC6, AC9. Schema `.strict()` nên không có chỗ cho transcript, audio, token                 |
| 🟢 ADDED    | Đo kích hoạt: 2 event client, `session_started` do server ghi, khối `beta` ở trang số liệu admin                         | AC7–8. D1 là [24h,48h), D7 là [7d,8d); không đủ dữ liệu thì hiện "Chưa đủ dữ liệu"         |
| 🟢 ADDED    | Phát hành: ADR 0017, `release.yml`, `updater-manifest.mjs`, plugin updater/process/os, `src/updater`, trang `/download`  | AC10–12. Không dùng `tauri-action`; updater chỉ nạp khi build với `CUELINGO_UPDATER=1`     |
| 🟡 MODIFIED | Glossary → sidecar làm mới mỗi 2 phút; copy debrief cả cuộc họp; DTO assist chặn `vi` ở lookup/compose                   | AC13–15. Recap vẫn nhận `vi`                                                               |
| 🟡 MODIFIED | `admin.repository.ts`                                                                                                    | Sửa lỗi có sẵn: truy vấn số liệu cũ hỏng trên Postgres thật (thiếu `::timestamptz`)        |
| 🟡 MODIFIED | `tauri.conf.json`: `targets` thêm `dmg`, `signingIdentity: "-"`                                                          | Build cục bộ giờ ký ad-hoc; `createUpdaterArtifacts` chỉ bật qua `--config` trong workflow |

**Docs đã cập nhật:** `04-modules` của api (invites, feedback, assist, events, admin, auth), web (admin-invites, feedback, debrief, admin-metrics), desktop (updater, tauri-core, overlay-quick-assist, session-controller), packages, kiến trúc (data model, security), ADR 0017.

## Tự review

Theo [checklist](../../05-engineering/conventions/code-review.md): ✅ Ranh giới & bảo mật (mã chỉ lưu băm, cookie httpOnly, feedback write-only, admin lọc theo quyền) · ✅ Hợp đồng (contract-sync cùng lúc) · ✅ Kiến trúc (`check:deps` xanh) · ✅ AI (không đổi prompt) · ✅ Test (unit + integration Postgres thật) · ✅ Docs · ✅ Phạm vi

```bash
pnpm verify
```

Đã chạy thật: `pnpm verify` xanh; test tích hợp (Testcontainers) 17 file xanh sau Lô 2; `cargo check`, `clippy`, `fmt` xanh sau khi thêm plugin. **Chưa chạy thật:** workflow release (cần khoá và repo của người), cập nhật qua updater, mở `.dmg` ký ad-hoc trên máy sạch, đổi Việt ↔ Anh trên cuộc họp thật.

## Cho người review — đọc theo thứ tự

| #   | File                                                     | Soi gì                                                          |
| --- | -------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | `services/api/src/modules/auth/auth.ts`                  | Cổng mã mời: chỉ `create-user`, mã trong cookie, không lộ lý do |
| 2   | `services/api/src/modules/invites/invites.repository.ts` | Dùng mã nguyên tử, không đua nhau dùng chung 1 lượt             |
| 3   | `packages/shared/src/dto/feedback.dto.ts`                | Không có trường nào chứa transcript hay token                   |
| 4   | `.github/workflows/release.yml`                          | Khoá, kiểm tra tag, kiểm tra token dev, tên tệp cố định         |
| 5   | `apps/desktop/src-tauri/src/lib.rs`                      | Updater chỉ nạp khi `CUELINGO_UPDATER=1`                        |

## Lỗi tìm thấy khi review/test

| Lỗi                                                     | Tìm ở              | Sửa                                                         |
| ------------------------------------------------------- | ------------------ | ----------------------------------------------------------- |
| Truy vấn số liệu admin có sẵn hỏng trên Postgres thật   | test tích hợp beta | `${now}::timestamptz - interval` ở mọi truy vấn             |
| Better Auth giới hạn tốc độ làm test tích hợp bị 429    | test tích hợp auth | Tắt rate limit khi `NODE_ENV==='test'`                      |
| `localStorage` không có trong test Node                 | test telemetry     | Tra `localStorage` muộn, trong try/catch                    |
| Import vòng telemetry ↔ use-activation                  | typecheck          | Tách singleton ra `telemetry/instance.ts`                   |
| `tauri_plugin_updater::Builder` không có `.endpoints()` | `cargo check`      | Endpoint và khoá nằm trong `plugins.updater` qua `--config` |

## Việc của người (H1–H7)

1. **H1** Tạo repo công khai chỉ chứa bản build; đặt variable `CUELINGO_RELEASES_REPO` và secret `RELEASES_TOKEN` (token ghi vào repo đó).
2. **H2** Tạo khoá updater: `pnpm --filter @cuelingo/desktop tauri signer generate`; đặt secrets `TAURI_SIGNING_PRIVATE_KEY(_PASSWORD)` và variable `CUELINGO_UPDATER_PUBKEY`. Giữ bản sao khoá riêng ở nơi an toàn.
3. **H3** Đặt variables `CUELINGO_API_URL`, `CUELINGO_WEB_URL`; đặt `NEXT_PUBLIC_DOWNLOAD_URL` cho web.
4. **H4** Đặt `ADMIN_EMAILS`, `INVITES_REQUIRED` mặc định bật ở production; tạo mã mời đầu tiên bằng `pnpm --filter @cuelingo/api invite:create`.
5. **H5** Chốt nơi triển khai và email (Q1) để người thử đăng nhập được; xoay khoá Resend và Gemini đã lộ trong phiên.
6. **H6** Gắn tag `v0.1.0` (khớp `tauri.conf.json`) để chạy release lần đầu, mở `.dmg` trên máy sạch, thử cập nhật lên `v0.1.1`.
7. **H7** Chạy thật: họp thật có thuật ngữ (AC13, P2-04 AC7), đổi Việt ↔ Anh giữa họp, caption đầu tiên đo bằng event.

## Spike: đổi Việt ↔ Anh giữa họp (Lô 5)

Đọc `session-controller.ts`, `audio_bridge.rs`, `main.swift`: sidecar giữ mô hình cũ cho tới khi mô hình mới `ready` (comment trong `set_language`), controller không xoá transcript khi đổi ngôn ngữ. Khoảng trống caption chỉ bằng thời gian tải mô hình, không cần sửa Swift. Chưa đo bằng tay trên máy thật: việc của người (H7).
