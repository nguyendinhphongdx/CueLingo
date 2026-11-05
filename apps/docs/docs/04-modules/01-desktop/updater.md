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

Gắn tag `vX.Y.Z` đúng bằng `version` trong `tauri.conf.json`. Workflow dựng sidecar, `tauri build` (arm64, ký ad-hoc, `createUpdaterArtifacts`), kiểm tra bundle không chứa token dev, sinh `latest.json` và đăng `CueLingo-macOS-arm64.dmg`, `CueLingo.app.tar.gz(.sig)`, `latest.json` lên repo bản build.

Biến cần có (do người đặt): secrets `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `RELEASES_TOKEN`; variables `CUELINGO_UPDATER_PUBKEY`, `CUELINGO_RELEASES_REPO`, `CUELINGO_API_URL`, `CUELINGO_WEB_URL`. Web: `NEXT_PUBLIC_DOWNLOAD_URL` trỏ tới `https://github.com/<repo>/releases/latest/download/CueLingo-macOS-arm64.dmg`.

## Câu hỏi mở

- Công chứng bằng Apple Developer (thay ADR 0017).
