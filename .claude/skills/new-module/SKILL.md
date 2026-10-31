---
name: new-module
description: Tạo API module mới trong services/api hoặc feature mới trong apps/web bằng cách copy module mẫu glossary. Dùng khi cần thêm một tài nguyên/endpoint backend hoặc một màn hình web mới. Không tự nghĩ layout.
---

# new-module — Copy từ module mẫu

## API module (`services/api`)

1. Contract trước: skill `contract-sync` để có `<X>Schema`, `Create<X>Schema`, `Update<X>Schema` trong `@cuelingo/shared`.
2. Copy:
   ```bash
   cp -r services/api/src/modules/glossary services/api/src/modules/<x>
   ```
3. Đổi tên file `glossary.*` → `<x>.*`, đổi tên type/hàm (`Glossary` → `<X>`), xoá logic riêng của glossary (kiểm tra trùng term).
4. Viết `<x>.test.ts` theo AC trước, gồm **test ranh giới người dùng** (user B → 404).
5. Service (business rule, `AppError`), repository (mọi query `WHERE user_id`), routes (chỉ parse → service → DTO).
6. Đăng ký trong `services/api/src/app.ts` + thêm repository vào `AppDeps.repos` và `server.ts`.
7. Migration mới nếu cần bảng: `infra/db/migrations/NNNN_<x>.sql` (số tiếp theo, không sửa file cũ).
8. Cập nhật `docs/03-parts/api/<x>.md` (Interface, Dữ liệu & sự kiện).
9. `pnpm verify`.

## Web feature (`apps/web`)

1. Client trước: thêm `packages/core-sdk/src/<x>.ts` + gắn vào `createClient` (theo `glossary.ts`).
2. `cp -r apps/web/src/features/glossary apps/web/src/features/<x>` rồi đổi tên.
3. `use-<x>.ts`: state + gọi `client.<x>`; `<X>Page.tsx`: chỉ trình bày; `index.ts`: export trang.
4. Cập nhật `docs/03-parts/web/<x>.md`. `pnpm verify`, rồi mở thật trong trình duyệt.

## Convention

[api-module](../../../docs/05-engineering/conventions/api-module.md) · [web-feature](../../../docs/05-engineering/conventions/web-feature.md) · [shared-contract](../../../docs/05-engineering/conventions/shared-contract.md)

## Anti-pattern

- ❌ Tạo layout khác module mẫu ("cho gọn").
- ❌ Bỏ test ranh giới người dùng.
- ❌ Khai báo type request/response trong module thay vì `@cuelingo/shared`.
- ❌ Quên đăng ký module trong `app.ts` rồi báo xong.
