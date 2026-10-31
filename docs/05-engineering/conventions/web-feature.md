# Convention · Web feature (`apps/web`, UI desktop)

Mẫu canonical: [`apps/web/src/features/glossary/`](../../../apps/web/src/features/glossary/). UI React của `apps/desktop/src` theo cùng quy ước.

## Layout

```text
src/
  lib/client.ts              API client duy nhất (createClient từ @cuelingo/core-sdk)
  features/<x>/
    index.ts                 export công khai (component trang)
    <X>Page.tsx              component trình bày: không gọi API, không fetch
    use-<x>.ts               state + action: gọi client, xử lý lỗi
    <x>.test.tsx             (khi có logic đáng test)
```

## Luật

| #   | Luật                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | Chỉ gọi backend qua `client` (`src/lib/client.ts`). Không `fetch` trực tiếp, không import `services/*` (máy kiểm) |
| 2   | Type dữ liệu lấy từ `@cuelingo/shared`, không khai báo lại                                                        |
| 3   | Component trình bày nhận dữ liệu từ hook; mọi side effect nằm trong `use-<x>.ts`                                  |
| 4   | Lỗi API: bắt `ApiError`, hiện thông báo tiếng Việt cho người dùng; không nuốt lỗi                                 |
| 5   | Feature khác chỉ import qua `features/<x>/index.ts` (máy kiểm)                                                    |
| 6   | Chữ trên UI bằng tiếng Việt; code, comment, tên biến bằng tiếng Anh                                               |
| 7   | Component dùng ở cả web và desktop → đưa vào `@cuelingo/ui`                                                       |

## Anti-pattern

- ❌ `fetch('/v1/...')` trong component.
- ❌ `interface GlossaryTerm { ... }` trong app.
- ❌ Một file component 400 dòng vừa gọi API vừa render.
