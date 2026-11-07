# Plan — pages-landing

## 1. Bối cảnh code

- Landing nằm ở `apps/web/src/features/landing` (`LandingPage`, `DownloadPage`, `PublicHeader`, `CaptionOverlay`, `landing.module.css`). Chúng phụ thuộc Next ở đúng ba chỗ: `next/link`, `useRouter` (chuyển hướng khi đã đăng nhập, `session-redirect.ts`) và `DOWNLOAD_URL` đọc từ `NEXT_PUBLIC_DOWNLOAD_URL`.
- `apps/desktop` đã là một app Vite + React dùng `@cuelingo/ui`, nên có sẵn mẫu cấu hình Vite/Tailwind.
- Quy tắc repo: web và client tái dùng `@cuelingo/ui`; `packages/ui` không gọi API. Workflow `release.yml` đã đăng `.dmg` tên cố định `CueLingo-macOS-arm64.dmg` và `latest.json` lên repo bản build (ADR 0017), nên link `releases/latest/download/…` luôn đúng.
- Mẫu workflow Pages chính thức: `actions/configure-pages` → `actions/upload-pages-artifact` → `actions/deploy-pages`. Repo ghim SHA cho action bên thứ ba; đây là action của GitHub nhưng vẫn ghim theo thói quen của `release.yml`.

## 2. Phương án

| #   | Phương án                                                                                                                                    | Ưu                                                                                        | Nhược                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A   | Xuất tĩnh chính `apps/web` (`output: 'export'`) rồi chỉ đăng các trang công khai                                                             | Không đổi cấu trúc                                                                        | `(app)` dùng đăng nhập/động, `headers()` và CSP không chạy trên Pages; dễ lộ đường dẫn và hỏng build |
| B   | Tách phần landing sang `@cuelingo/ui` (nhận `Link` và cấu hình qua props), thêm `apps/site` (Vite + React) dựng 2 trang tĩnh, workflow Pages | Một nguồn nội dung cho web và site; site nhỏ, không kéo API/đăng nhập; build tĩnh thật sự | Phải chuyển 5 file và sửa import ở web; `useRouter` phải tách ra ngoài                               |
| C   | Viết trang HTML/CSS thuần trong repo bản build                                                                                               | Nhanh nhất, không phụ thuộc gì                                                            | Nội dung trùng với `/download`, lệch dần; không dùng `@cuelingo/ui` (trái AC6)                       |

**Chọn: B.** Chỉ B thoả AC1 (không cần API) và AC6 (một nguồn nội dung) cùng lúc. A rủi ro vì phải xuất tĩnh cả app có đăng nhập; C vi phạm AC6. Không cần ADR mới: không đổi kiến trúc phát hành, chỉ thêm một kênh phân phối trang; ghi lại trong `04-modules` và ADR 0017 (một dòng "Hệ quả").

Mặc định cho các câu hỏi mở (đổi được ở cổng này): Pages đặt **cùng repo bản build** (`CUELINGO_RELEASES_REPO`), địa chỉ mặc định `https://<user>.github.io/<repo>/`, hai trang (chủ + tải về). Tên repo tôi chưa biết nên đọc từ biến, không đặt cứng.

| Tác động                            | Có?   | Chi tiết                                                                        |
| ----------------------------------- | ----- | ------------------------------------------------------------------------------- |
| DB migration                        | Không |                                                                                 |
| Contract (`@cuelingo/shared`)       | Không |                                                                                 |
| Event / Learner Model               | Không |                                                                                 |
| Prompt / model AI                   | Không |                                                                                 |
| Quyền riêng tư / dữ liệu người dùng | Không | Trang tĩnh, không gọi API, không cookie. Quét chuỗi nhạy cảm trong build (AC7). |

## 3. Các bước (mỗi bước ≈ 1 commit)

| #   | Bước                                                                                                                                                                   | File                                                                      | Điểm mở rộng |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------ |
| 1   | Chuyển `PublicHeader`, `DownloadPage`, phần hiển thị của `LandingPage`, `CaptionOverlay` và CSS sang `packages/ui`; `Link` và đường dẫn truyền qua props; web dùng lại | `packages/ui/src/components/landing/*`, `apps/web/src/features/landing/*` | UI chung     |
| 2   | Tạo `apps/site` (Vite + React, 2 trang `index.html`, `download/index.html`), nút tải lấy từ biến build `VITE_DOWNLOAD_URL`, bản không có biến thì khoá nút (AC2, AC3)  | `apps/site/**`, `pnpm-workspace`/turbo nếu cần                            | App mới      |
| 3   | Thêm nội dung "app tự hỏi cập nhật" (AC8) vào phần dùng chung; test nội dung và hai trạng thái nút (AC1–AC4, AC8)                                                      | `packages/ui` landing test, `apps/site` test                              | UI chung     |
| 4   | Workflow `pages.yml`: build `apps/site` với `base` đúng tên repo, quét chuỗi nhạy cảm (AC7), deploy bằng Pages khi đổi nội dung (AC5)                                  | `.github/workflows/pages.yml`                                             | CI           |
| 5   | Docs: trang module site, ADR 0017 (hệ quả), hướng dẫn H1 (tạo repo, bật Pages, biến); `pnpm verify` + `pnpm docs:build`                                                | `apps/docs/docs/04-modules/**`, `08-adr/0017-*.md`                        | Docs         |

## 4. Rủi ro

| Rủi ro                                                                                | Giảm thiểu                                                                               |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Chuyển component làm hỏng trang web hiện có (CSS module, test)                        | Bước 1 giữ nguyên test của web; chạy `pnpm verify` trước khi sang bước 2                 |
| Đường dẫn gốc sai trên Pages (`/<repo>/`) làm hỏng CSS/ảnh                            | Truyền `base` từ tên repo trong workflow; mở bản build qua `vite preview --base` để kiểm |
| Không chạy thật được workflow Pages và link tải vì cần repo/biến của bạn (H1)         | Ghi rõ "chưa chạy thật" ở `03-review.md`; kiểm cục bộ bản build và `actionlint`          |
| Link tải 404 cho tới khi có release đầu tiên                                          | Nút khoá khi chưa cấu hình; hướng dẫn gắn tag `v0.1.0` trước khi chia sẻ link            |
| Trang nói "tự cập nhật" nhưng bản ký ad-hoc có thể hỏi lại quyền sau mỗi lần cập nhật | Giữ câu cảnh báo như `/download` hiện có                                                 |

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                                         |
| ---------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-07 | Plan | Trình phương án B; câu hỏi mở dùng mặc định (cùng repo bản build, URL mặc định, 2 trang)                                                                              |
| 2026-11-07 | Code | Rẽ nhánh từ `feat/ai-agent` vì code landing chỉ có ở đó, không có ở `main`                                                                                            |
| 2026-11-07 | Code | Chọn SPA Vite, không prerender: đơn giản, đủ cho hai trang; ghi thành câu hỏi mở. Bị từ chối: prerender bằng plugin Vite (thêm máy móc, CSS module phải dựng hai lần) |
| 2026-11-07 | Code | `pages.yml` ghim SHA dù `release.yml` hiện dùng thẻ `@v4`; base path lấy từ `configure-pages`; link tải chỉ tính khi biến đúng `owner/name`                           |
| 2026-11-07 | Code | Quét bản build làm script có test (`scan-dist.mjs`) thay vì `grep` trong YAML                                                                                         |
| 2026-11-07 | Code | Phát hiện: Pages nằm ở repo chạy workflow (repo mã nguồn), lệch với H1 "cùng repo bản build"; để chủ sản phẩm quyết, ghi ở `03-review.md`                             |
| 2026-11-07 | Code | Không chạy được `vite preview` (sandbox chặn cổng cục bộ); thay bằng kiểm tham chiếu tài nguyên trên đĩa với base `/cuelingo-releases/`                               |
