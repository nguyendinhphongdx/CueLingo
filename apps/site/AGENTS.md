# AGENTS.md — apps/site

Trang tĩnh công khai (Vite + React) đăng lên GitHub Pages. Thiết kế: [Site công khai](../docs/docs/04-modules/07-site/README.md).

- Không gọi API, không `fetch`, không cookie, không import `@cuelingo/shared` hay `core-sdk`. Giao diện lấy từ `@cuelingo/ui` (trang landing nằm ở `packages/ui/src/components/landing`); không chép nội dung sang đây.
- Env chỉ đọc ở `src/config.ts` (`VITE_DOWNLOAD_URL`, `BASE_URL`). Không đặt khoá, token hay địa chỉ API riêng tư vào build; workflow `pages.yml` quét `dist` và dừng nếu thấy.
- Mọi link nội bộ đi qua `paths` (có tiền tố `base`), vì trên Pages trang nằm dưới `/<repo>/`.
- Chữ trên UI tiếng Việt.
- Chạy: `pnpm --filter @cuelingo/site build`, rồi `vite preview` (thử cả `SITE_BASE=/ten-repo/`).
