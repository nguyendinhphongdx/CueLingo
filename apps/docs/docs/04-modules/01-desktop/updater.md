# Cập nhật app

> Phần: [Desktop](./README.md) · Code: `apps/desktop/src/updater/`, `scripts/updater-manifest.mjs`, `.github/workflows/release.yml` · [ADR 0017](../../08-adr/0017-beta-distribution-adhoc-updater.md)

## Trách nhiệm

- Hỏi endpoint cập nhật khi mở app và mỗi 6 giờ (`UPDATE_CHECK_MS`).
- Hiện banner "Có bản mới" ở trang Phiên họp; chỉ cài khi người dùng bấm "Cập nhật".
- Trang Cài đặt có mục `UpdateSection`: phiên bản đang chạy, nút "Kiểm tra cập nhật" báo đủ kết quả (đang kiểm tra · bản mới nhất kèm giờ · có bản mới kèm nút Cập nhật · không kiểm tra được · bản này không tự cập nhật). Dùng chung trạng thái với banner.
- Khoá nút trong lúc có cuộc họp (trạng thái phiên khác `idle`), vì cập nhật khởi động lại app.
- Gói có chữ ký không khớp bị từ chối; banner nói rõ và chỉ về trang tải về.

## Interface

`createUpdateController({check, meetingActive})` trả về `getState`, `getManual`, `subscribe`, `check`, `checkNow`, `install`, `dismiss`. Trạng thái: `none`, `available`, `installing`, `failed (signature | other)`. `native.checkUpdate()` trả `null` khi đã mới nhất, `'unsupported'` khi build không có updater (bản dev, bản tự dựng).

- `check()` chạy nền (khi mở, mỗi 6 giờ): lỗi bị nuốt, lần sau thử lại.
- `checkNow()` khi người dùng bấm: ghi kết quả vào `getManual()` (`idle` · `checking` · `upToDate{at}` · `unsupported` · `error`).
- Mỗi lúc chỉ một yêu cầu tới endpoint: bấm trong lúc kiểm tra nền đang chạy thì chờ chính lần đó.
- `useUpdater()` (gắn một lần ở App) chạy kiểm tra định kỳ; `useUpdateStatus()` chỉ đọc trạng thái chung.

## Phát hành

Gắn tag `vX.Y.Z` đúng bằng `version` trong `tauri.conf.json`. Workflow `release.yml` có ba job:

| Job       | Máy            | Việc                                                                                                                                                                                                                                                                                                                                                         |
| --------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `macos`   | `macos-15`     | Dựng sidecar, `tauri build` (arm64, ký ad-hoc, `createUpdaterArtifacts`), kiểm bundle không chứa token dev, gửi `CueLingo-macOS-arm64.dmg`, `CueLingo.app.tar.gz(.sig)` lên artifact                                                                                                                                                                         |
| `windows` | `windows-2025` | Kiểm tag khớp version, dựng sidecar Rust (sherpa-onnx ghim SHA-256), `tauri build --no-bundle --config release.conf.json` (khoá updater và `plugins.updater.windows` ghi vào tệp, không truyền chuỗi JSON), kiểm bundle không chứa token dev, `windows-installer.mjs` dựng `CueLingo-Windows-x64-setup.exe`, `tauri signer sign` ra `.sig`, gửi lên artifact |
| `publish` | `ubuntu-24.04` | Chỉ chạy khi cả `macos` và `windows` xong. Kiểm đủ năm tệp. Sinh **một** `latest.json` cho mọi nền tảng (`updater-manifest.mjs <version> <platform> <bundle> <url> …`), tạo release dạng draft, gắn đủ tệp rồi mới công khai                                                                                                                                 |

Bản Windows (`scripts/windows-installer.mjs`, `installer/windows/CueLingo.iss`, [ADR 0021](../../08-adr/0021-windows-release-inno.md)) là **beta**: release và `latest.json` (khoá `windows-x86_64`) đã có nó, nhưng **chưa có nút tải công khai** (xem [Site công khai](../07-site/README.md)) và thu âm trên Windows chưa chạy. Workflow `desktop-windows.yml` vẫn dựng bản cài cho mỗi PR để kiểm. Hai điều chưa thử trên máy thật (đợt B, spike S3): Inno Setup bỏ qua tham số `/UPDATE` mà plugin thêm vào, và `installerArgs` (`/VERYSILENT … /CUELINGORELAUNCH`) cập nhật im lặng rồi mở lại app. Bản cài chưa ký Authenticode, SmartScreen sẽ cảnh báo.

Release luôn tạo ở dạng draft trước, nên link `releases/latest/download/…` không bao giờ trỏ vào một release thiếu tệp; nếu một trong hai job dựng hỏng thì `publish` không chạy và không có release nào ([windows-desktop](../../06-delivery/2026-11-13-windows-desktop/02-plan.md)). Tên tệp cố định: `CueLingo-macOS-arm64.dmg`, `CueLingo.app.tar.gz(.sig)`, `CueLingo-Windows-x64-setup.exe(.sig)`, `latest.json`.

Biến cần có (do người đặt): secrets `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`; variables `CUELINGO_UPDATER_PUBKEY`, `CUELINGO_API_URL`, `CUELINGO_WEB_URL`. Link tải không cần biến riêng: web (`web-cloudflare.yml` → `NEXT_PUBLIC_DOWNLOAD_URL`) và [Site công khai](../07-site/README.md) (`pages.yml` → `VITE_DOWNLOAD_URL`) cùng tự tính `https://github.com/<owner>/<repo>/releases/latest/download/CueLingo-macOS-arm64.dmg` từ chính repo này. Link Windows (`NEXT_PUBLIC_DOWNLOAD_URL_WINDOWS`, `VITE_DOWNLOAD_URL_WINDOWS`) **cố ý chưa đặt** trong hai workflow đó: bản Windows là beta nên chưa có nút tải công khai. Release đăng bằng `GITHUB_TOKEN`, không cần token riêng.

## Câu hỏi mở

- Công chứng bằng Apple Developer (thay ADR 0017).
