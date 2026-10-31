---
title: contract-sync
---

# Workflow · contract-sync — Một nguồn schema, mọi bên cùng đổi

Dùng mỗi khi request/response, message WebSocket, event, payload job hoặc mã lỗi thay đổi.

1. **Schema trước** trong `packages/shared/src/`:
   - DTO: `dto/<x>.dto.ts` — `<X>Schema`, `Create<X>Schema`, `Update<X>Schema`, `<X>ListSchema` + type `z.infer`/`z.input`/`z.output`.
   - Mã lỗi: chỉ thêm vào `errors/error-code.ts`.
   - Event: `events/` ([events](../conventions/events.md)). Job payload: `jobs.ts`. WebSocket: `ws/`.
   - Re-export ở `src/index.ts`.
2. Test schema: nhận input hợp lệ, từ chối input sai, giá trị mặc định.
3. `pnpm typecheck` → **danh sách lỗi chính là danh sách chỗ cần sửa**. Sửa hết:
   - `services/api`: routes parse bằng schema mới, kiểu trả về đúng DTO.
   - `packages/core-sdk`: hàm client parse response bằng schema mới.
   - `apps/*`, `services/workers`: dùng type mới.
4. Breaking (đổi tên/xoá field) → nêu ở cổng PLAN; app desktop bản cũ có thể đang chạy.
5. `pnpm verify`.

Luật: Zod là nguồn sự thật; không `interface` song song; `@cuelingo/shared` không import framework hay package nội bộ (máy kiểm); ngày giờ `z.iso.datetime()`, id `z.uuid()` (hoặc kiểu id của Better Auth cho `user_id`).

## Anti-pattern

- ❌ Khai báo lại type ở app "cho nhanh".
- ❌ Đổi schema rồi để typecheck đỏ cho commit sau.
- ❌ Client không parse response bằng schema.
