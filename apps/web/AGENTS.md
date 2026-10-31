# AGENTS.md — apps/web

Next.js. Thiết kế: [apps/docs/docs/04-modules/02-web](../docs/docs/04-modules/02-web/README.md).

- **Convention:** [web-feature](../docs/docs/05-engineering/conventions/web-feature.md).
- **Feature mẫu:** [`src/features/glossary/`](src/features/glossary/) (component trình bày + hook `use-<x>`).
- Gọi backend chỉ qua `src/lib/client.ts`. Type từ `@cuelingo/shared`.
- Chưa scaffold Next.js App Router; khi scaffold, route trong `src/app/` chỉ render component từ `features/*`.
- Chữ trên UI tiếng Việt. Verify: chạy thật trong trình duyệt, không chỉ test.
- **Scaffold:** [web-nextjs](../../apps/docs/docs/05-engineering/scaffold/04-web-nextjs.md) (không chạy `create-next-app` vào thư mục này). **Thêm feature:** [new-module](../../apps/docs/docs/05-engineering/workflows/new-module.md).
