# Site công khai (GitHub Pages)

> Code: `apps/site/`, `.github/workflows/pages.yml` · Stack: Vite + React, tĩnh · Giai đoạn: beta · [ADR 0017](../../08-adr/0017-beta-distribution-adhoc-updater.md)

Hai trang tĩnh để gửi cho người thử bên ngoài: giới thiệu và hướng dẫn cài. Không gọi API, không đăng nhập, không cookie.

## Trách nhiệm

- Trang chủ (`index.html`) và trang tải (`download/index.html`) dựng từ `@cuelingo/ui`, dùng chung nội dung với `/download` của web.
- Nút "Tải cho macOS" trỏ tới `CueLingo-macOS-arm64.dmg` mới nhất ở repo bản build. Chưa có repo thì nút khoá "Sắp có bản tải".
- Nói rõ yêu cầu (macOS 14.2+, Apple Silicon), cách mở bản chưa công chứng, cách cấp quyền, và việc app tự kiểm tra bản mới rồi hỏi trước khi cài.

## Phạm vi MVP

- Hai trang, tiếng Việt. Không tên miền riêng, không Windows/Linux, không đổi cơ chế tự cập nhật.

## Interface

| Thứ                     | Nội dung                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `VITE_DOWNLOAD_URL`     | Link tải, chỉ nhận `https:`; rỗng hoặc sai thì nút khoá. Chỉ đọc ở `src/config.ts`                                        |
| `SITE_BASE`             | Đường dẫn gốc khi build, ví dụ `/<repo>/` (mặc định `/`). Workflow tính từ tên repo bản build                             |
| `src/config.ts`         | `parseDownloadUrl`, `sitePaths(base)` (trả `LandingPaths`, không có `login`)                                              |
| `src/pages.tsx`         | `SiteHome`, `SiteDownload`: gắn `LandingView`, `DownloadPage` của `@cuelingo/ui` với `paths` và link                      |
| `scripts/scan-dist.mjs` | `scanDist(dir, forbidden)`: quét bản build tìm khoá, token, host dev, địa chỉ riêng; in tên tệp và luật, không in giá trị |

Component dùng chung nhận `link` và `paths` qua props, xem [UI](../05-packages/ui.md#trang-giới-thiệu-và-tải-về).

## Workflow `pages.yml`

Chạy khi push lên `main` có đổi `apps/site`, `packages/ui`, `pnpm-lock.yaml` hoặc chính workflow; có thể chạy tay.

1. Tính `SITE_BASE` từ `CUELINGO_RELEASES_REPO` (`/<tên repo>/`, hoặc `/` với repo `<user>.github.io`); biến sai dạng thì job dừng.
2. Tính `VITE_DOWNLOAD_URL = https://github.com/<CUELINGO_RELEASES_REPO>/releases/latest/download/CueLingo-macOS-arm64.dmg`; biến trống hoặc không đúng dạng `owner/name` thì để trống (nút khoá) và báo warning.
3. Build, kiểm cả hai trang tồn tại.
4. Quét bản build (AC7), thêm hai địa chỉ riêng `CUELINGO_API_URL`, `CUELINGO_WEB_URL` vào danh sách cấm.
5. Đẩy `dist` thành một commit lên nhánh `gh-pages` của repo bản build bằng `RELEASES_TOKEN`. Các action ghim theo SHA commit.

## Việc chủ sản phẩm làm (H1)

1. Tạo repo công khai chứa bản build, đặt biến `CUELINGO_RELEASES_REPO` (dạng `owner/name`) và các secret/biến ở ADR 0017 cho `release.yml`.
2. Ở repo **bản build** (công khai): Settings → Pages → Source: **Deploy from a branch** → `gh-pages` / `/ (root)`. Repo mã nguồn riêng tư không có Pages theo gói hiện tại, nên workflow trong repo mã nguồn đẩy bản build sang đây. Cần secret `RELEASES_TOKEN` ghi được vào repo bản build.
3. Gắn tag `v0.1.0` cho `release.yml` trước khi chia sẻ link, nếu không nút tải trả 404.
4. Vào tab Actions chạy "Pages" một lần (hoặc push vào `main`). Địa chỉ: `https://<user>.github.io/<repo>/`.
5. Đổi `CUELINGO_RELEASES_REPO` thì chạy lại workflow để link trong trang đổi theo.

## Phụ thuộc

`@cuelingo/ui`, `react`, `vite`, `@tailwindcss/vite`. Không phụ thuộc `shared`, `core-sdk`, service nào.

## Dữ liệu & sự kiện

- (không có) Không gọi mạng khi chạy, không lưu gì phía người dùng.

## Câu hỏi mở

- Đã chốt: Pages nằm ở repo mã nguồn (2026-11-07). Còn cần tên repo bản build thật để đặt `CUELINGO_RELEASES_REPO`.
- HTML tĩnh chỉ chứa khung; nội dung do React dựng trong trình duyệt. Cần hiện chữ khi tắt JavaScript hoặc cho công cụ tìm kiếm thì thêm prerender.
