# AGENTS.md — apps/web

Next.js. Thiết kế: [apps/docs/docs/04-modules/02-web](../docs/docs/04-modules/02-web/README.md).

- **Convention:** [web-feature](../docs/docs/05-engineering/conventions/web-feature.md).
- **Feature mẫu:** [`src/features/glossary/`](src/features/glossary/) (component trình bày + hook `use-<x>`).
- Gọi backend chỉ qua `src/lib/client.ts`. Type từ `@cuelingo/shared`.
- **App Router đã dựng:** route trong `src/app/` chỉ render component từ `features/*` (route group `(auth)` = đăng nhập, `(app)` = cần session, bọc bởi `AppShell`). Feature mẫu: `glossary` (`GlossaryPage` container + `GlossaryList` thuần + `use-glossary` TanStack Query); auth: `features/auth`.
- **Env** chỉ đọc ở `src/lib/config.ts`. **Lỗi API** hiện cho người dùng qua `describeError` (`src/lib/errors.ts`, tiếng Việt theo mã lỗi), không bao giờ hiện `error.message` của server.
- **Chạy:** `pnpm --filter @cuelingo/web dev` (webpack, cần API ở `NEXT_PUBLIC_API_URL`). Dùng `dev:turbo` nếu terminal của bạn cho phép: Turbopack cần mở cổng cục bộ và bị chặn trong sandbox của agent.
- **Style:** class Tailwind của component trong `@cuelingo/ui` chỉ có khi `globals.css` của UI khai `@source` tới thư mục đó (đã có, có test); component UI mới nằm trong `packages/ui/src/components`.
- **Bản tĩnh (Cloudflare Pages):** `build:static` xuất `out/`. Không dùng tính năng máy chủ (middleware, route handler, `cookies()`); route động chỉ có một trang giữ chỗ nên **đọc id bằng `useRouteId`**, không từ `params`. Header bảo mật thêm ở `securityHeaders` (`src/lib/csp.ts`). Chi tiết: [Deploy Cloudflare](../docs/docs/04-modules/02-web/deploy-cloudflare.md).
- Chữ trên UI tiếng Việt. Verify: chạy thật trong trình duyệt, không chỉ test.
- **Scaffold:** [web-nextjs](../../apps/docs/docs/05-engineering/scaffold/04-web-nextjs.md) (không chạy `create-next-app` vào thư mục này). **Thêm feature:** [new-module](../../apps/docs/docs/05-engineering/workflows/new-module.md).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
