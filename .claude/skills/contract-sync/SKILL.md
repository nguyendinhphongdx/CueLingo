---
name: contract-sync
description: Thêm hoặc đổi schema/DTO/mã lỗi/event trong @cuelingo/shared và đồng bộ tất cả nơi dùng (services/api, packages/core-sdk, apps/*) trong cùng một thay đổi. Dùng mỗi khi request/response, payload WebSocket hoặc event thay đổi.
---

# contract-sync — Một nguồn schema, mọi bên cùng đổi

## Quy trình

1. **Schema trước** trong `packages/shared/src/`:
   - DTO: `dto/<x>.dto.ts` — `<X>Schema`, `Create<X>Schema`, `Update<X>Schema`, `<X>ListSchema` + type `z.infer`/`z.input`/`z.output`.
   - Mã lỗi: chỉ thêm vào `errors/error-code.ts`.
   - Event: `events/` (xem [events](../../../docs/05-engineering/conventions/events.md)).
   - Re-export ở `src/index.ts`.
2. Test schema: chấp nhận input hợp lệ, từ chối input sai, giá trị mặc định.
3. Chạy `pnpm typecheck` → **danh sách lỗi chính là danh sách chỗ cần sửa**. Sửa hết:
   - `services/api`: routes parse bằng schema mới, kiểu trả về đúng DTO.
   - `packages/core-sdk`: hàm client dùng schema mới để parse response.
   - `apps/*`: dùng type mới.
4. Đổi tên/xoá field (breaking) → nêu rõ ở cổng PLAN; desktop bản cũ có thể đang chạy.
5. `pnpm verify`.

## Luật

- Zod là nguồn sự thật; không viết `interface` song song.
- Không import framework hay package nội bộ khác vào `@cuelingo/shared` (máy kiểm).
- Ngày giờ `z.iso.datetime()`, id `z.uuid()`.

## Anti-pattern

- ❌ Khai báo lại type ở app "cho nhanh".
- ❌ Đổi schema rồi để typecheck đỏ cho commit sau.
- ❌ Response không parse bằng schema ở client.
