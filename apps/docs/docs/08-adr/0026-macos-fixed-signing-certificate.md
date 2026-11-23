# 0026 · Ký bản beta macOS bằng chứng chỉ self-signed cố định

**Trạng thái:** Proposed · 2026-11-16 · Thay mục "Ký ad-hoc" và hệ quả "mỗi lần cập nhật hỏi lại quyền" của [0017](0017-beta-distribution-adhoc-updater.md) (hồ sơ [mac-permissions](../06-delivery/2026-11-16-mac-permissions/01-specs.md)). Chờ chủ sản phẩm duyệt việc tạo chứng chỉ.

## Bối cảnh

Bản 0.1.5 ký ad-hoc: yêu cầu chữ ký (designated requirement, DR) của app là `cdhash H"…"`, đổi ở mỗi bản build. macOS (TCC) gắn quyền micro và ghi âm thanh hệ thống với DR của app nên coi bản mới là app khác và hỏi lại quyền. App và sidecar còn chạy hardened runtime mà **không có entitlement `com.apple.security.device.audio-input`**, nên macOS từ chối micro mà không hiện hộp thoại. Chưa có tài khoản Apple Developer.

## Quyết định

- **Một chứng chỉ self-signed cố định** (RSA 3072, hạn 20 năm, CN `CueLingo Code Signing`, chỉ dùng ký mã) ký cả app lẫn sidecar. DR trở thành `identifier "vn.cmcai.cuelingo" and certificate leaf = H"<sha1 của chứng chỉ>"`, giữ nguyên qua các bản, nên quyền được giữ khi cập nhật.
- Sidecar có identifier cố định `vn.cmcai.cuelingo.audio` (ký bởi `scripts/sidecar.mjs` trước `tauri build`).
- **Giữ hardened runtime** và thêm entitlements (`device.audio-input`, `personal-information.calendars`) cho app (`src-tauri/entitlements.plist`) và sidecar (`native/macos-audio/Sidecar.entitlements`).
- Khoá nằm trong GitHub Secrets `MACOS_CERT_P12`, `MACOS_CERT_PASSWORD` cộng một bản sao ngoài git. `release.yml` nhập vào keychain tạm, truyền SHA-1 cho `APPLE_SIGNING_IDENTITY`, kiểm `codesign --verify`, entitlements và DR với `apps/desktop/signing/*.requirement`, rồi xoá keychain.
- **Thiếu secret thì bản build vẫn ra, ký ad-hoc, kèm cảnh báo** (và bỏ kiểm DR). Bản dev (`pnpm tauri dev`) luôn ký ad-hoc.
- Không đổi: khoá updater của Tauri, `latest.json`, cảnh báo Gatekeeper.

## Hệ quả

- Lần cập nhật **đầu tiên** lên bản ký cố định vẫn hỏi lại quyền một lần (DR đổi từ cdhash sang chứng chỉ). Ghi chú bản phát hành báo trước. Từ bản sau không hỏi nữa.
- Lộ khoá riêng: người khác ký được app có cùng DR với TCC, nhưng không qua được chữ ký updater của Tauri nên không đẩy được bản cập nhật. Mất khoá: tạo chứng chỉ mới, người dùng cấp quyền lại một lần.
- Gatekeeper vẫn cảnh báo "nhà phát triển không xác định" như bản ad-hoc.
- Đo ở hồ sơ này: bộ đệm biên dịch CoreML của macOS gắn với từng bản binary (cdhash), nên mỗi bản mới biên dịch lại model khoảng 40 s dù identifier không đổi. Việc thu âm trước, nạp model sau và bước chuẩn bị model ở Cài đặt che phần chờ này.
- Khi có Apple Developer ID: đổi chứng chỉ, thêm công chứng, viết ADR mới thay mục này; người dùng cấp lại quyền một lần.
