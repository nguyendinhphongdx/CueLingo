---
title: new-module
---

# Workflow · new-module — Copy từ module mẫu

Thêm một tài nguyên/endpoint backend hoặc một màn hình web. **Copy cấu trúc từ module mẫu `glossary`, không tự nghĩ layout.** Nếu là task không đơn giản (gần như luôn vậy), chạy trong [task-loop](./task-loop.md).

## API module (`services/api`)

1. Contract trước: [contract-sync](./contract-sync.md) → `<X>Schema`, `Create<X>Schema`, `Update<X>Schema` trong `@cuelingo/shared`.
2. Copy:
   ```bash
   cp -r services/api/src/modules/glossary services/api/src/modules/<x>
   ```
3. Đổi tên file `glossary.*` → `<x>.*`, đổi tên type/hàm (`Glossary` → `<X>`), xoá logic riêng của glossary (kiểm tra trùng term).
4. Viết `<x>.test.ts` theo AC **trước**, gồm **test ranh giới người dùng** (user B → 404).
5. Service (business rule, `AppError`) → repository (mọi query `WHERE user_id`) → routes (chỉ parse → service → DTO).
6. Đăng ký trong `services/api/src/app.ts` + thêm repository vào `AppDeps.repos` và `server.ts`.
7. Bảng mới → migration mới (`pnpm db:new <x>`), không sửa migration cũ.
8. Cập nhật `apps/docs/docs/04-modules/03-api/<x>.md` (Interface, Dữ liệu & sự kiện).
9. `pnpm verify`; gọi thật endpoint.

## Web feature (`apps/web`)

1. Client trước: `packages/core-sdk/src/<x>.ts` + gắn vào `createClient` (theo `glossary.ts`), có test với `fetch` giả.
2. `cp -r apps/web/src/features/glossary apps/web/src/features/<x>` rồi đổi tên.
3. `use-<x>.ts`: dữ liệu + hành động (TanStack Query qua `client.<x>`); `<X>Page.tsx`: chỉ trình bày, component từ `@cuelingo/ui`; `index.ts`: export trang.
4. Route trong `src/app/(app)/<x>/page.tsx` chỉ render `<X>Page`.
5. Cập nhật `apps/docs/docs/04-modules/02-web/<x>.md`. `pnpm verify`, rồi mở thật trong trình duyệt.

Quy ước chi tiết: [api-module](../conventions/api-module.md) · [web-feature](../conventions/web-feature.md) · [shared-contract](../conventions/shared-contract.md).

## Anti-pattern

- ❌ Layout khác module mẫu "cho gọn".
- ❌ Bỏ test ranh giới người dùng.
- ❌ Type request/response khai báo trong module thay vì `@cuelingo/shared`.
- ❌ Quên đăng ký module trong `app.ts` rồi báo xong.
