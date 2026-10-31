---
title: UI package
---

# Scaffold · UI package (`@cuelingo/ui`, Tailwind 4 + shadcn/ui)

**Kết quả:** `packages/ui` chứa design tokens (sáng/tối), CSS toàn cục Tailwind 4 và component shadcn/ui. Web (Next.js) và desktop (Vite) cùng import từ `@cuelingo/ui/...`. Thêm component mới bằng CLI shadcn chạy từ thư mục app.

Quyết định: [ADR-0007](../../08-adr/0007-ui-stack.md). Cơ chế monorepo của shadcn: mỗi workspace có `components.json`; component dùng chung cài vào package UI, app import qua tên package.

## Cây thư mục

```text
packages/ui/
├── components.json
├── package.json              exports bên dưới
└── src/
    ├── styles/globals.css    @import "tailwindcss"; tokens; @source tới app
    ├── lib/utils.ts          cn() (clsx + tailwind-merge)
    ├── hooks/
    └── components/           button.tsx, input.tsx, … (shadcn) + component riêng: caption-line.tsx, phrase-card.tsx…
```

`package.json`:

```json
{
  "name": "@cuelingo/ui",
  "type": "module",
  "exports": {
    "./globals.css": "./src/styles/globals.css",
    "./components/*": "./src/components/*.tsx",
    "./lib/*": "./src/lib/*.ts",
    "./hooks/*": "./src/hooks/*.ts"
  },
  "peerDependencies": { "react": "^19" }
}
```

## Các bước

1. Cài: `pnpm --filter @cuelingo/ui add clsx tailwind-merge class-variance-authority lucide-react` và `tailwindcss` làm devDependency.
2. `packages/ui/components.json` (Tailwind 4 → `"config": ""`):
   ```json
   {
     "style": "new-york",
     "tailwind": {
       "config": "",
       "css": "src/styles/globals.css",
       "baseColor": "neutral",
       "cssVariables": true
     },
     "iconLibrary": "lucide",
     "aliases": {
       "components": "@cuelingo/ui/components",
       "utils": "@cuelingo/ui/lib/utils",
       "hooks": "@cuelingo/ui/hooks",
       "lib": "@cuelingo/ui/lib",
       "ui": "@cuelingo/ui/components"
     }
   }
   ```
3. `apps/web/components.json` (và `apps/desktop/components.json`): cùng `style`, `baseColor`, `iconLibrary`; alias `ui` và `utils` trỏ `@cuelingo/ui/...`, `components` trỏ `@/components` của app.
4. `globals.css`: `@import "tailwindcss";`, biến màu sáng/tối (`:root` / `.dark`), và `@source` tới mã nguồn các app để Tailwind quét class:
   ```css
   @source "../../../../apps/web/src";
   @source "../../../../apps/desktop/src";
   ```
5. Thêm component: `cd apps/web && pnpm dlx shadcn@latest add button input card` — CLI đặt component dùng chung vào `packages/ui/src/components`. Kiểm `git status` đúng chỗ.

Lệnh `init` của shadcn cho monorepo mới (`--monorepo`) tạo cả app mới; repo này đã có app nên **cấu hình tay** như trên. Nếu CLI đổi format `components.json`, theo tài liệu shadcn bản đang dùng và sửa trang này.

## Quy ước

- Component shadcn sửa được (code nằm trong repo), nhưng sửa ít và có lý do.
- Component nghiệp vụ dùng chung (CaptionLine, PhraseCard, ReviewCard, DebriefBlocks) đặt ở đây, nhận dữ liệu qua props, **không** gọi API.
- Màu và khoảng cách dùng token; không mã màu cứng trong component.

## Definition of Done

- [ ] Web và desktop render cùng một `Button` từ `@cuelingo/ui/components/button`, đúng cả sáng và tối.
- [ ] Thêm một component bằng CLI từ `apps/web` → file nằm ở `packages/ui`.
- [ ] `pnpm verify` xanh; package không import `apps/*` (máy kiểm).
