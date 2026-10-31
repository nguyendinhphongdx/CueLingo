# CLAUDE.md — apps/web

Next.js. Thiết kế: [docs/03-parts/web](../../docs/03-parts/web/README.md).

- **Convention:** [web-feature](../../docs/05-engineering/conventions/web-feature.md).
- **Feature mẫu:** [`src/features/glossary/`](src/features/glossary/) (component trình bày + hook `use-<x>`).
- Gọi backend chỉ qua `src/lib/client.ts`. Type từ `@cuelingo/shared`.
- Chưa scaffold Next.js App Router; khi scaffold, route trong `src/app/` chỉ render component từ `features/*`.
- Chữ trên UI tiếng Việt. Verify: chạy thật trong trình duyệt, không chỉ test.
