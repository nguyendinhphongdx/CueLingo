---
title: Web (Next.js)
---

# Scaffold · Web (`apps/web`, Next.js App Router)

**Kết quả:** `apps/web` chạy Next.js App Router, giữ nguyên `src/features/*` và `src/lib/client.ts`. Trang Thuật ngữ (feature mẫu `glossary`) chạy với API thật, dùng TanStack Query và component từ `@cuelingo/ui`, có đăng nhập qua Better Auth.

Quyết định: [ADR-0007](../../08-adr/0007-ui-stack.md). Quy ước: [web-feature](../conventions/web-feature.md).

## Điều kiện trước

- [UI package](./05-ui-package.md) xong (Tailwind 4 + shadcn trong `@cuelingo/ui`).
- [API foundation](./02-api-foundation.md) xong (auth + CORS cho `WEB_ORIGIN`).

## Các bước

**Không** chạy `create-next-app` vào `apps/web` (nó ghi đè cấu trúc có sẵn). Cài tay:

```bash
pnpm --filter @cuelingo/web add next@<major> react react-dom @tanstack/react-query better-auth
pnpm --filter @cuelingo/web add -D @tailwindcss/postcss tailwindcss
```

Script trong `apps/web/package.json`: `"dev": "next dev --port 3000"`, `"build": "next build"`, `"start": "next start"`, `"typecheck": "tsc --noEmit"`. Chạy `pnpm --filter @cuelingo/web dev` một lần để Next tự bổ sung `tsconfig.json` (plugin `next`, `next-env.d.ts`), rồi commit phần đó.

## Cây thư mục

```text
apps/web/
├── next.config.ts            transpilePackages: ['@cuelingo/ui', '@cuelingo/shared', '@cuelingo/core-sdk']
├── postcss.config.mjs        { plugins: { '@tailwindcss/postcss': {} } }
└── src/
    ├── app/                  CHỈ route + layout; render component từ features
    │   ├── layout.tsx        <html lang="vi">, import '@cuelingo/ui/globals.css', <Providers>
    │   ├── providers.tsx     'use client' — QueryClientProvider
    │   ├── (auth)/login/page.tsx
    │   └── (app)/
    │       ├── layout.tsx    khung trang + chặn khi chưa đăng nhập
    │       └── glossary/page.tsx   export { GlossaryPage as default } … (bọc 'use client' nếu cần)
    ├── features/<x>/         giữ nguyên quy ước: index.ts · <X>Page.tsx · use-<x>.ts
    └── lib/
        ├── client.ts         core-sdk (credentials: 'include' để gửi cookie session)
        └── auth-client.ts    createAuthClient({ baseURL: NEXT_PUBLIC_API_URL }) từ 'better-auth/react'
```

## Đổi feature mẫu sang TanStack Query

`use-glossary.ts` dùng `useQuery({ queryKey: ['glossary'], queryFn: () => client.glossary.list() })` và `useMutation` cho create/remove (invalidate `['glossary']`). Query key của mỗi feature đặt trong `features/<x>/keys.ts`. Component vẫn chỉ trình bày, dùng `Button`, `Input`… từ `@cuelingo/ui`.

`core-sdk` cần tuỳ chọn `credentials` để trình duyệt gửi cookie session sang API khác origin. Thêm vào `ClientOptions` + test (theo [contract-sync](../workflows/contract-sync.md)).

## Biến môi trường

| Biến                  | Ví dụ                   | Dùng ở                                |
| --------------------- | ----------------------- | ------------------------------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | `lib/client.ts`, `lib/auth-client.ts` |

## Definition of Done

- [ ] `pnpm --filter @cuelingo/web dev` → mở http://localhost:3000/login, đăng nhập, vào `/glossary`, thêm/xoá thuật ngữ, tải lại trang vẫn còn (DB thật).
- [ ] `pnpm --filter @cuelingo/web build` thành công; `pnpm verify` xanh (luật `web-features-via-index` vẫn áp dụng).
- [ ] Không còn file mẫu của Next (logo, trang demo).
- [ ] Docs: [web](../../04-modules/02-web/README.md), [Tổ chức thư mục](../../03-architecture/03-folder-structure.md).

## Anti-pattern

- ❌ Logic hoặc gọi API trong `src/app/**` — route chỉ render feature.
- ❌ `fetch` trực tiếp thay vì `client`.
- ❌ Copy component shadcn vào `apps/web/components` khi nó dùng được ở desktop — đặt ở `@cuelingo/ui`.

## Bài học khi chạy thật (2026-11-01)

Dựng và chạy trong trình duyệt thật (đăng nhập magic link → `/glossary` → thêm/xoá → đăng xuất) lộ ra những điều test đơn vị không thấy:

| Hiện tượng                                                    | Nguyên nhân                                                                                | Cách xử lý                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `next build` lỗi `binding to a port: Operation not permitted` | Turbopack chạy PostCSS trong một tiến trình con nghe cổng cục bộ; sandbox của agent chặn   | Script `dev` và `build` dùng `--webpack`; `dev:turbo` cho terminal của người dùng                |
| Trang không có style dù CSS đã nạp                            | Tailwind chỉ quét từ thư mục app; class của `@cuelingo/ui` (bg-card, h-9…) không được sinh | `@source "../components"` trong `packages/ui/src/styles/globals.css`, kèm test `globals.test.ts` |
| Bấm Xoá không làm gì; mạng báo `ERR_FAILED` sau preflight     | `@fastify/cors` mặc định chỉ cho `GET, HEAD, POST`                                         | API cho phép `PATCH`, `DELETE`; test preflight trong `services/api/src/app.test.ts`              |
| Thông báo lỗi hiện tiếng Anh của server                       | Hiện thẳng `error.message`                                                                 | `describeError` ánh xạ mã lỗi → tiếng Việt (`src/lib/errors.ts`)                                 |
| `typecheck` thiếu type route khi build sạch                   | Next sinh type khi chạy                                                                    | Script `typecheck` = `next typegen && tsc --noEmit`; `next-env.d.ts` đã gitignore                |

Cookie session do API (`localhost:4000`) đặt được gửi sang web (`localhost:3000`) vì cookie không phân biệt cổng. Ở production hai origin khác nhau (ví dụ `app.` và `api.` cùng domain gốc) cần cấu hình cookie domain của Better Auth, chưa làm ở giai đoạn này.
