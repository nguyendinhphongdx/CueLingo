# Review — pages-landing

## Thay đổi so với plan

| Dấu         | File / hành vi                                                                                                                                     | Chi tiết (lý do nếu khác plan)                                                                                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 ADDED    | `packages/ui/src/components/landing/*` (`landing-view`, `download-page`, `public-header`, `caption-overlay`, `landing-link`, `landing.module.css`) | Chuyển từ `apps/web`. Tên tệp kebab-case theo `packages/ui`. `Link`, `paths` qua props; `login: null` ẩn liên kết đăng nhập. Thêm `LandingSessionCheck` để web giữ màn "đang kiểm tra phiên" mà CSS vẫn nằm một chỗ |
| 🟢 ADDED    | `packages/ui/src/css-modules.d.ts`                                                                                                                 | Khai báo kiểu `*.module.css` cho `tsc` của package UI (chưa có CSS module nào ở đây trước đó)                                                                                                                       |
| 🟢 ADDED    | `apps/site/**` (Vite, `index.html`, `download/index.html`, `src/config.ts`, `src/pages.tsx`)                                                       | `SITE_BASE` cho base path; `VITE_DOWNLOAD_URL` chỉ nhận `https:`. Thêm `AGENTS.md`/`CLAUDE.md` cho app mới                                                                                                          |
| 🟢 ADDED    | `apps/site/scripts/scan-dist.mjs` + test                                                                                                           | Plan viết "bước quét trong workflow"; làm thành script có test thay vì `grep` rải rác, để AC7 kiểm được                                                                                                             |
| 🟢 ADDED    | `.github/workflows/pages.yml`                                                                                                                      | Base path lấy từ `configure-pages` (đúng cả repo `<user>.github.io`). Link tải chỉ tính khi biến đúng dạng `owner/name`, nếu không để trống (nút khoá) thay vì ghép ra `github.com//releases/...`                   |
| 🟡 MODIFIED | `apps/web/src/features/landing/{LandingPage,DownloadPage}.tsx`                                                                                     | Còn là lớp mỏng: `next/link`, `useRouter` + `redirectSignedInVisitor` ở lại web. Test web (`LandingPage.test`, `DownloadPage.test`) giữ nguyên, vẫn xanh                                                            |
| 🟡 MODIFIED | `download-page.tsx` (nội dung)                                                                                                                     | Thêm "chip Apple Silicon" và mục "Cập nhật" (AC4, AC8). Văn bản mô tả đúng `use-updater.ts`: kiểm khi mở và định kỳ, hỏi trước, chờ khi đang họp. Ảnh hưởng cả trang `/download` của web (một nguồn nội dung, AC6)  |
| 🟡 MODIFIED | `packages/ui/src/styles/globals.css`                                                                                                               | Thêm `@source` tới `apps/site/src` cho Tailwind                                                                                                                                                                     |
| 🔴 REMOVED  | `apps/web/src/features/landing/{PublicHeader,CaptionOverlay}.tsx`, `landing.module.css`                                                            | Đã chuyển sang UI                                                                                                                                                                                                   |

**Nhánh gốc:** code landing chỉ có ở `feat/ai-agent`, không có ở `main`, nên `feat/pages-landing` rẽ từ `feat/ai-agent` (không phải `main`).

**Docs đã cập nhật:** `04-modules/07-site/README.md` (mới), `04-modules/05-packages/ui.md`, `04-modules/README.md`, `04-modules/01-desktop/updater.md`, ADR 0017 (một dòng Hệ quả), `AGENTS.md` gốc và `apps/site/AGENTS.md`.

## Kết quả theo AC

| AC  | Trạng thái   | Bằng chứng / chưa kiểm                                                                                                                                                                           |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1 | Một phần     | `pages.test.tsx` (trang chủ có nút, không có đăng nhập/API). Bản build là SPA: HTML chỉ có khung, chữ do React dựng trong trình duyệt. **Chưa mở bằng trình duyệt thật** (xem dưới)              |
| AC2 | Đạt          | `pages.test.tsx` (href đúng dạng `releases/latest/download/CueLingo-macOS-arm64.dmg`); build thật với `VITE_DOWNLOAD_URL` thì chuỗi nằm trong JS. **Link thật chưa thử** vì chưa có repo/release |
| AC3 | Đạt          | `config.test.ts` (rỗng, sai, `http:`, `javascript:` đều khoá), `pages.test.tsx` (nút `disabled`, không có link)                                                                                  |
| AC4 | Đạt          | `pages.test.tsx` (macOS 14.2, Apple Silicon, Open Anyway, chưa công chứng, Microphone, Screen & System Audio Recording)                                                                          |
| AC5 | Chưa kiểm    | Workflow qua `node-actionlint` 1.2.2 (bản cũ). **Chưa chạy trên GitHub**, cần H1                                                                                                                 |
| AC6 | Đạt          | Một bộ component ở `packages/ui`; web và site cùng dùng; `pnpm verify` xanh, depcruise không vi phạm                                                                                             |
| AC7 | Đạt (cục bộ) | `scan-dist.test.ts` (khoá, token, localhost, địa chỉ riêng) và chạy `scan-dist.mjs` trên bản build thật: 7 tệp, sạch. Bước trong workflow chưa chạy trên GitHub                                  |
| AC8 | Đạt          | `pages.test.tsx` ("App tự kiểm tra bản mới", "app hỏi bạn trước", "chỉ cài khi bạn bấm Cập nhật")                                                                                                |

## Tự review

Theo [checklist](../../05-engineering/conventions/code-review.md): ranh giới & bảo mật (trang tĩnh, không `userId`, không API) · hợp đồng (không đổi) · kiến trúc (UI dùng chung, site không import `shared`/`core-sdk`) · AI (không) · test · docs · phạm vi (không đụng `release.yml`).

```bash
pnpm verify      # xanh: format:check, lint, typecheck, test (201 file / 1533 test), check:deps
pnpm docs:build  # xanh, không link hỏng
```

**Đã chạy thật**

- `pnpm verify` ở Node 22.14 (repo yêu cầu ≥ 22.19, pnpm chỉ cảnh báo).
- `pnpm --filter @cuelingo/web build` (Next) sau khi chuyển component: qua.
- `pnpm --filter @cuelingo/site build` với `SITE_BASE=/cuelingo-releases/` và `VITE_DOWNLOAD_URL` giả: mọi 8 tham chiếu tài nguyên trong hai trang HTML nằm dưới base và có tệp tương ứng trong `dist`; `scan-dist.mjs` sạch.

**Chưa chạy / không kiểm được**

- **`vite preview` và mở trang trong trình duyệt**: sandbox chặn mở cổng cục bộ (`listen EPERM`), nên chưa xem được trang chạy, chưa kiểm base không gốc bằng preview thật. Thay bằng kiểm tệp trên đĩa như trên. Cách tự kiểm: `SITE_BASE=/cuelingo-releases/ pnpm --filter @cuelingo/site build && pnpm --filter @cuelingo/site exec vite preview`, rồi mở `http://localhost:4173/cuelingo-releases/` và `.../download/`.
- **Deploy Pages thật** và `actions/*` ở SHA đã ghim: chưa chạy (cần H1). SHA lấy từ API công khai của GitHub lúc làm, chưa thử chạy.
- **`actionlint` chuẩn**: không cài được. `node-actionlint` 1.2.2 báo `pages` không phải permission và `vars` không tồn tại; cả hai là báo sai do bản cũ, và nó báo y hệt trên `release.yml` đang chạy. Không có lỗi nào khác. Nên chạy `actionlint` mới trên máy có sẵn.
- **Link `.dmg` thật** và nút tải ở trang đã deploy.
- Giao diện trực quan trên web sau khi chuyển CSS module: `next build` qua, nhưng chưa nhìn bằng mắt.

## Điều cần chủ sản phẩm quyết

1. **Pages nằm repo nào.** `pages.yml` chạy ở repo chứa nó (repo mã nguồn), nên Pages ở đó, không ở repo bản build như H1 trong spec. Repo mã nguồn riêng tư cần gói cho phép Pages. Nếu muốn ở repo bản build thì phải đưa `apps/site` và workflow sang đó. Chưa làm.
2. **"Ghim SHA như `release.yml`"**: `release.yml` hiện dùng thẻ `@v4`, không ghim SHA. `pages.yml` ghim SHA (kèm chú thích phiên bản); `release.yml` giữ nguyên vì ngoài phạm vi.
3. Trang là SPA (không prerender). Nếu cần hiện chữ khi tắt JS hoặc cho công cụ tìm kiếm thì làm thêm.

## Cho người review — đọc theo thứ tự

| #   | File                                                   | Soi gì                                                                                      |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 1   | `packages/ui/src/components/landing/landing-link.tsx`  | Hợp đồng props `link`/`paths`, `login: null`                                                |
| 2   | `apps/web/src/features/landing/LandingPage.tsx`        | Web còn giữ chuyển hướng phiên, không đổi hành vi                                           |
| 3   | `apps/site/src/config.ts`, `pages.tsx`                 | Chỉ nhận https; mọi link qua `paths`                                                        |
| 4   | `.github/workflows/pages.yml`                          | Quyền, ghim SHA, bước tính link tải, bước quét                                              |
| 5   | `apps/site/scripts/scan-dist.mjs`                      | Luật quét có thiếu/quá tay không (`localhost` có thể báo nhầm nếu thư viện nhúng chuỗi này) |
| 6   | `packages/ui/src/components/landing/download-page.tsx` | Văn bản cập nhật có đúng với `use-updater.ts`                                               |

## Lỗi tìm thấy khi review/test

| Lỗi                                                                                 | Tìm ở                        | Sửa                                                                    |
| ----------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| Biến `CUELINGO_RELEASES_REPO` trống sẽ ghép ra `https://github.com//releases/...`   | Soát workflow                | Chỉ tính link khi đúng `owner/name`, nếu không để trống và báo warning |
| Lỗi kiểu `href` có thể `undefined` trong test; tôi đã commit khi `verify` chưa xanh | `pnpm verify` bước typecheck | Sửa test và gộp vào đúng commit của bước 3 (`--amend`, chưa push)      |

> Cập nhật 2026-11-07: workflow không còn dùng `configure-pages`/`deploy-pages`; nó đẩy bản build lên `gh-pages` của repo bản build (xem decision log trong `01-specs.md`). Chưa chạy thật.
