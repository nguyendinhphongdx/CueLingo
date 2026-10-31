# Convention · Contract dùng chung (`@cuelingo/shared`, `@cuelingo/core-sdk`)

Mẫu canonical: `packages/shared/src/dto/glossary.dto.ts`, `core-sdk/src/glossary.ts` (`packages/core-sdk/src/glossary.ts`).

## `@cuelingo/shared`

```text
src/
  dto/<x>.dto.ts       Zod schema request/response + type infer
  errors/error-code.ts ErrorCode + ErrorResponseSchema
  events/<x>.ts        catalog event (xem events.md)
  ws/                  message WebSocket (realtime)
  index.ts             re-export
```

| #   | Luật                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------ |
| 1   | **Zod schema là nguồn sự thật**; type = `z.infer` / `z.input` / `z.output`. Không viết `interface` song song |
| 2   | Không import framework (fastify, react, next, postgres) hay package nội bộ khác (máy kiểm)                   |
| 3   | Đặt tên: `<X>Schema`, `Create<X>Schema`, `Update<X>Schema`, `<X>ListSchema`; type cùng tên bỏ `Schema`       |
| 4   | Ngày giờ là chuỗi ISO (`z.iso.datetime()`); id là UUID (`z.uuid()`)                                          |
| 5   | Mã lỗi mới chỉ thêm ở `ErrorCode`                                                                            |
| 6   | Đổi schema → sửa API, client, app trong **cùng commit**; `pnpm typecheck` phải xanh                          |

## Client

`@cuelingo/core-sdk` bọc mỗi tài nguyên thành một file `src/<x>.ts`, gắn vào `createClient`. Mọi response được **parse bằng schema** của `@cuelingo/shared`: nếu backend lệch hợp đồng thì lỗi hiện ngay ở client, không chui sâu vào UI. Lỗi HTTP → `ApiError { status, code, message, details }`.
