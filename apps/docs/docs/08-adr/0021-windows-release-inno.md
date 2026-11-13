# 0021 · Phát hành Windows: Inno Setup per-user, chưa ký mã, một release cho hai nền tảng

**Trạng thái:** Proposed · 2026-11-13 (bản cài Inno Setup do chủ sản phẩm chốt; cách cập nhật chờ spike S3 trong hồ sơ [windows-desktop](../06-delivery/2026-11-13-windows-desktop/02-plan.md)). Bổ sung [0017](0017-beta-distribution-adhoc-updater.md).

## Bối cảnh

Bản Windows cần bản cài, tự cập nhật và cùng kênh phát hành với macOS. Tauri tự dựng NSIS hoặc MSI, nhưng chủ sản phẩm chọn **Inno Setup**. Plugin updater của Tauri chạy bản cài Windows với tham số kiểu NSIS và thoát app ngay sau đó.

## Quyết định

- **Bản cài Inno Setup**, script `apps/desktop/installer/windows/CueLingo.iss`, CI dựng bằng `ISCC` sau `tauri build --no-bundle`. Cài cho riêng người dùng (`PrivilegesRequired=lowest`, `{localappdata}\Programs\CueLingo`), Windows 10 22H2 trở lên, chỉ x64. Ghi `cuelingo://` vào `HKCU`, kiểm WebView2, gỡ cài đặt xoá thư mục cài, model, token và khoá registry. Tên tệp cố định `CueLingo-Windows-x64-setup.exe`.
- **Tự cập nhật:** plugin Tauri chạy thẳng bản cài Inno (`installMode: basicUi`, `installerArgs` `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /CLOSEAPPLICATIONS`, bản cài tự mở lại app). Nếu spike S3 không qua: một lệnh Rust nhỏ tải gói qua plugin (vẫn kiểm chữ ký minisign) rồi tự chạy bản cài với cùng tham số. Quy tắc hỏi, khoá khi họp, từ chối chữ ký sai giữ như 0017.
- **Chưa ký Authenticode cho beta.** Trang tải hướng dẫn vượt SmartScreen. Chữ ký updater minisign (cùng khoá với macOS) vẫn bắt buộc.
- **Một tag, một release cho hai nền tảng.** `release.yml` có job dựng cho từng nền tảng và job `publish` chỉ chạy khi tất cả xong; release tạo dạng draft rồi mới công khai. Một `latest.json` có `darwin-aarch64` và `windows-x86_64`.

## Phương án đã cân nhắc

- NSIS hoặc MSI do Tauri dựng: ít việc hơn nhưng không theo lựa chọn Inno Setup của chủ sản phẩm.
- Tự viết toàn bộ updater (tải, kiểm minisign, cài): viết lại đúng phần nhạy cảm nhất, hai nền tảng đi hai đường.
- Azure Trusted Signing hoặc chứng chỉ OV ngay từ beta: tốn tiền, mất thời gian xác minh; pháp nhân Việt Nam có thể không đủ điều kiện Trusted Signing.

## Hệ quả

- Máy Windows 11 bật Smart App Control chặn hẳn bản chưa ký; Defender có thể báo nhầm. Cân nhắc ký mã trước khi mở công khai.
- Job Windows hỏng thì không phát hành được cả bản vá macOS (đánh đổi đã chấp nhận ở spec AC2).
- Bản cài và updater Windows chỉ kiểm được trên máy Windows thật.
