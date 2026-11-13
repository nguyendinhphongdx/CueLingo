# Cập nhật app

> Phần: [Desktop](./README.md) · Code: `apps/desktop/src/updater/`, `scripts/updater-manifest.mjs`, `.github/workflows/release.yml` · [ADR 0017](../../08-adr/0017-beta-distribution-adhoc-updater.md)

## Trách nhiệm

- Hỏi endpoint cập nhật khi mở app và mỗi 6 giờ (`UPDATE_CHECK_MS`).
- Hiện banner "Có bản mới" ở trang Phiên họp; chỉ cài khi người dùng bấm "Cập nhật".
- Khoá nút trong lúc có cuộc họp (trạng thái phiên khác `idle`), vì cập nhật khởi động lại app.
- Gói có chữ ký không khớp bị từ chối; banner nói rõ và chỉ về trang tải về.

## Interface

`createUpdateController({check, meetingActive})` trả về `getState`, `subscribe`, `check`, `install`, `dismiss`. Trạng thái: `none`, `available`, `installing`, `failed (signature | other)`. `native.checkUpdate()` trả `null` khi đã mới nhất và cả khi build không có updater. Lỗi khi hỏi bản mới bị nuốt: lần sau thử lại, không có gì hỏng.

## Phát hành

Gắn tag `vX.Y.Z` đúng bằng `version` trong `tauri.conf.json`. Workflow `release.yml` có hai loại job:

| Job       | Máy            | Việc                                                                                                                                                                                             |
| --------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `macos`   | `macos-15`     | Dựng sidecar, `tauri build` (arm64, ký ad-hoc, `createUpdaterArtifacts`), kiểm bundle không chứa token dev, gửi `CueLingo-macOS-arm64.dmg`, `CueLingo.app.tar.gz(.sig)` lên artifact             |
| `publish` | `ubuntu-24.04` | Chỉ chạy khi mọi job dựng xong. Sinh **một** `latest.json` cho mọi nền tảng (`updater-manifest.mjs <version> <platform> <bundle> <url> …`), tạo release dạng draft, gắn đủ tệp rồi mới công khai |

Release luôn tạo ở dạng draft trước, nên link `releases/latest/download/…` không bao giờ trỏ vào một release thiếu tệp. Job Windows sẽ thêm vào `needs` của `publish` ([windows-desktop](../../06-delivery/2026-11-13-windows-desktop/02-plan.md)).

Biến cần có (do người đặt): secrets `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`; variables `CUELINGO_UPDATER_PUBKEY`, `CUELINGO_API_URL`, `CUELINGO_WEB_URL`. Link tải không cần biến riêng: web (`web-cloudflare.yml` → `NEXT_PUBLIC_DOWNLOAD_URL`) và [Site công khai](../07-site/README.md) (`pages.yml` → `VITE_DOWNLOAD_URL`) cùng tự tính `https://github.com/<owner>/<repo>/releases/latest/download/CueLingo-macOS-arm64.dmg` từ chính repo này. Release đăng bằng `GITHUB_TOKEN`, không cần token riêng.

## Câu hỏi mở

- Công chứng bằng Apple Developer (thay ADR 0017).
