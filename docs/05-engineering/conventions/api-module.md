# Convention · API module (`services/api`)

Mẫu canonical: [`services/api/src/modules/glossary/`](../../../services/api/src/modules/glossary/). **Tạo module mới = copy thư mục này rồi đổi tên**, không tự nghĩ layout.

## Layout

```text
src/
  app.ts                      composition root: nối repository → service → routes (chỉ ở đây)
  server.ts                   đọc env, tạo DB client, listen
  lib/                        errors (AppError + error handler) · http (parse) · auth · db
  modules/<x>/
    index.ts                  API công khai của module: create<X>Module + type + repository factory
    <x>.routes.ts             HTTP: parse input → gọi service → trả DTO. KHÔNG business logic
    <x>.service.ts            business rule, ném AppError
    <x>.repository.ts         interface + bản Postgres. Mọi query lọc theo userId
    <x>.repository.memory.ts  bản in-memory cùng interface, dùng cho test
    <x>.test.ts               test qua buildApp + app.inject
```

## Luật

| #   | Luật                                                                                                                                    | Vì sao                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | `userId` chỉ lấy từ `request.userId` (auth hook). **Không bao giờ** từ body, params, query                                              | Ranh giới dữ liệu giữa người dùng |
| 2   | Mọi query của repository có `WHERE user_id = ${userId}`. Không tìm thấy tài nguyên của người khác → `NOT_FOUND`, không phải `FORBIDDEN` | Không lộ sự tồn tại               |
| 3   | Input không tin cậy đi qua `parse(Schema, data)` với schema từ `@cuelingo/shared`                                                       | Một nguồn schema                  |
| 4   | Response trả đúng type DTO của `@cuelingo/shared` (khai báo kiểu trả về của handler)                                                    | Hợp đồng không trôi               |
| 5   | Lỗi có chủ đích: `throw new AppError(ErrorCode.X, message, details?)`. Lỗi khác tự thành 500                                            | Một format lỗi                    |
| 6   | Module khác chỉ import qua `modules/<x>/index.ts` (máy kiểm)                                                                            | Ranh giới module                  |
| 7   | Không gọi SDK AI trực tiếp; dùng `@cuelingo/ai-gateway` (máy kiểm)                                                                      | Chi phí, fallback, log            |
| 8   | Việc chậm (> 1 s, gọi AI dài, debrief) → enqueue job cho `services/workers`, route trả ngay                                             | Độ trễ API                        |
| 9   | SQL viết tay bằng `postgres` (tagged template, tự escape). Không nối chuỗi SQL                                                          | SQL injection                     |

## Thêm module mới

1. Thêm schema vào `packages/shared/src/dto/<x>.dto.ts` ([shared-contract](shared-contract.md)).
2. `cp -r services/api/src/modules/glossary services/api/src/modules/<x>` rồi đổi tên file, type, hàm.
3. Viết test trước theo AC, rồi service, repository, routes.
4. Đăng ký trong `src/app.ts`: `await app.register(create<X>Module(deps.repos.<x>).routes, { prefix: '/v1/<x>' })`.
5. Migration mới nếu cần bảng (`infra/db/migrations/NNNN_<x>.sql`).
6. Cập nhật `docs/03-parts/api/<x>.md` (Interface, Dữ liệu).

## Anti-pattern

- ❌ Business logic trong `*.routes.ts`.
- ❌ `request.body.userId`, `request.params.userId`.
- ❌ Định nghĩa type request/response ngay trong module thay vì ở `@cuelingo/shared`.
- ❌ Import `../other-module/other.service` (đi qua `index.ts`).
- ❌ `try/catch` nuốt lỗi rồi trả 200.
