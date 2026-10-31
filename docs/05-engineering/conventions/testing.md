# Convention · Test

Mẫu canonical: [`glossary.test.ts`](../../../services/api/src/modules/glossary/glossary.test.ts).

| Tầng                               | Test gì                                                        | Cách                                                    |
| ---------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| `packages/shared`                  | Schema chấp nhận/từ chối đúng                                  | Vitest, `schema.parse` / `safeParse`                    |
| `packages/learner-model`           | Mọi quy tắc (FSRS, giai đoạn, Assist Dial)                     | Vitest thuần, không mock I/O vì không có I/O            |
| `services/api` module              | Hành vi HTTP theo AC: mã trạng thái, ranh giới người dùng, lỗi | `buildApp` + repository in-memory + `app.inject`        |
| `services/api` repository Postgres | SQL đúng                                                       | Integration test với Postgres thật (docker), chạy riêng |
| `packages/core-sdk`                | Gửi đúng request, parse response và lỗi                        | `fetch` giả (`vi.fn`)                                   |
| `apps/*`                           | Hook có logic; luồng chính chạy thật trong trình duyệt/app     | Vitest + chạy thật                                      |
| AI task                            | Chất lượng                                                     | `ml/eval`, không phải unit test                         |

## Luật

1. Mỗi AC (EARS) trong hồ sơ task ↔ ít nhất một test. Viết test trước khi code khi có thể.
2. Mỗi module API có test **ranh giới người dùng**: user B không đọc/sửa/xoá được tài nguyên của user A.
3. File test nằm cạnh code: `<x>.test.ts`.
4. Không gọi mạng thật, không gọi model AI thật trong unit test.
5. Báo xong chỉ khi `pnpm verify` xanh **và** đã chạy thật luồng vừa sửa.
