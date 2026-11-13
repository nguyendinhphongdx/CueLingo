# 0017 · Phát hành beta: ký ad-hoc, GitHub Releases, tự cập nhật Tauri

**Trạng thái:** Accepted · 2026-11-05 · Bổ sung bởi [0021](0021-windows-release-inno.md) (bản Windows, release chung hai nền tảng) (chủ sản phẩm chốt kênh GitHub Releases và chưa dùng Apple Developer trong hồ sơ [beta-readiness](../06-delivery/2026-11-05-beta-readiness/01-specs.md))

## Bối cảnh

Beta kín cho 30–50 người cần một bản `.dmg` tải được và tự cập nhật. Chưa có tài khoản Apple Developer nên chưa ký và công chứng được. Repo mã nguồn riêng tư, người thử không có quyền đọc.

## Quyết định

- **Ký ad-hoc** (`signingIdentity: "-"`), không công chứng. Người dùng gỡ chặn Gatekeeper một lần theo hướng dẫn ở `/download`. Chỉ Apple Silicon (arm64).
- **Phát hành lên một repo công khai chỉ chứa bản build** (`CUELINGO_RELEASES_REPO`), do workflow `release.yml` đăng khi gắn tag `v*` bằng token riêng (`RELEASES_TOKEN`). Tên tệp `.dmg` cố định `CueLingo-macOS-arm64.dmg` để link `releases/latest/download/…` luôn đúng.
- **Tự cập nhật bằng `tauri-plugin-updater`.** Gói `.app.tar.gz` được ký bằng khoá updater của Tauri; khoá công khai nằm trong build, khoá riêng nằm trong GitHub secrets. App từ chối gói có chữ ký không khớp. `latest.json` do `scripts/updater-manifest.mjs` sinh.
- Plugin updater chỉ được nạp khi build với `CUELINGO_UPDATER=1` (workflow release). Build dev và build cục bộ không có updater, nên không cần khoá.
- App hỏi bản mới khi mở và mỗi 6 giờ, không tự cài, không cài khi đang họp.
- Không dùng `tauri-action` (hành động bên thứ ba cần ghim SHA); workflow gọi `tauri build` và `gh release create` trực tiếp.

## Hệ quả

- Mỗi lần cập nhật đổi chữ ký ad-hoc nên macOS có thể hỏi lại quyền micro và ghi âm hệ thống; banner và `/download` báo trước.
- Mất khoá riêng updater nghĩa là mọi người phải tải lại bản cài tay. Giữ bản sao ở nơi an toàn.
- Khi có Apple Developer: thay `signingIdentity`, thêm công chứng, viết ADR mới thay mục này.
- Địa chỉ máy chủ lúc build chỉ là mặc định: người thử đổi được máy chủ trong app (đăng xuất, lưu trên máy, khởi động lại), nên đổi nơi đặt máy chủ không cần phát hành lại `.dmg`. Chữ ký bản cập nhật không phụ thuộc máy chủ API đã chọn. Xem [Máy chủ](../04-modules/01-desktop/server.md).
- Người thử bên ngoài vào một trang tĩnh trên GitHub Pages (`apps/site`, workflow `pages.yml`) để đọc giới thiệu và tải `.dmg`; trang không cần API và không chứa khoá. Xem [Site công khai](../04-modules/07-site/README.md).
