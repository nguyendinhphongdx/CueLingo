---
title: API foundation
---

# Scaffold · API foundation (`services/api`)

**Kết quả:** `services/api` có cấu hình kiểm bằng Zod, migration bằng dbmate, client hàng đợi pg-boss, đăng nhập thật bằng Better Auth thay cho header dev, integration test với Postgres thật, và Dockerfile. Module mẫu `glossary` vẫn chạy và test vẫn xanh.

Quyết định liên quan: [ADR-0005](../../08-adr/0005-modular-monolith-postgres.md) · [ADR-0008 Better Auth](../../08-adr/0008-auth-better-auth.md) · [ADR-0009 dbmate](../../08-adr/0009-migrations-dbmate.md) · [ADR-0011 triển khai](../../08-adr/0011-deployment-containers-sg.md).

## Điều kiện trước

- Docker chạy được (`docker compose -f infra/docker-compose.yml up -d`).
- Đã đọc [api-module](../conventions/api-module.md) và module mẫu `services/api/src/modules/glossary/`.

## 1. Cấu hình — `src/config.ts`

Biến môi trường chỉ được đọc **một chỗ**, parse bằng Zod; app lỗi ngay lúc khởi động nếu thiếu.

```ts
import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  WEB_ORIGIN: z.url(),
});
export type Config = z.infer<typeof ConfigSchema>;
export const loadConfig = (env = process.env): Config => ConfigSchema.parse(env);
```

`server.ts` gọi `loadConfig()` rồi truyền `config` vào `buildApp`. Không chỗ nào khác đọc `process.env`. Thêm biến mới → thêm vào schema **và** `.env.example`.

## 2. Migration — dbmate

```bash
pnpm add -w -D dbmate
```

Script ở `package.json` gốc (thư mục migration giữ ở `infra/db/migrations`):

```json
"db:new": "dbmate --migrations-dir infra/db/migrations new",
"db:migrate": "dbmate --migrations-dir infra/db/migrations --no-dump-schema up",
"db:rollback": "dbmate --migrations-dir infra/db/migrations --no-dump-schema rollback",
"db:status": "dbmate --migrations-dir infra/db/migrations status"
```

Định dạng file (`<timestamp>_<tên>.sql`, tạo bằng `pnpm db:new <tên>`):

```sql
-- migrate:up
CREATE TABLE ...;

-- migrate:down
DROP TABLE ...;
```

Đã làm (giai đoạn Nền móng): `0001_init.sql` thành `20261101090000_init.sql` có `-- migrate:up` / `-- migrate:down` (lần sửa duy nhất vì chưa chạy ở đâu); bỏ mount `docker-entrypoint-initdb.d` trong `infra/docker-compose.yml`, migration chỉ chạy bằng `pnpm db:migrate` (đọc `DATABASE_URL` từ `.env`). CI không cần service Postgres: integration test tự dựng container bằng Testcontainers và chạy dbmate lên đó (`test/integration/postgres.ts`).

## 3. Hàng đợi — `src/lib/queue.ts`

API chỉ **gửi** job; worker xử lý ([Worker](./03-worker.md)). pg-boss 12 dùng named export, phải `createQueue` trước khi gửi/nhận.

```ts
import { PgBoss } from 'pg-boss';

export type Queue = Pick<PgBoss, 'send'>;

export async function createQueue(databaseUrl: string, names: string[]): Promise<PgBoss> {
  const boss = new PgBoss(databaseUrl);
  boss.on('error', (err) => console.error('pg-boss', err));
  await boss.start();
  for (const name of names) await boss.createQueue(name);
  return boss;
}
```

Tên queue và schema payload nằm ở `@cuelingo/shared` (`src/jobs.ts`) để API và worker dùng chung. Service nhận `Queue` qua `AppDeps`; test dùng bản giả ghi lại các lời gọi `send`.

## 4. Auth — Better Auth

```bash
pnpm --filter @cuelingo/api add better-auth pg
pnpm --filter @cuelingo/api add -D @types/pg
```

**Dữ liệu:** Better Auth sở hữu bảng định danh. Ta đặt tên có tiền tố qua `modelName` (`auth_user`, `auth_session`, `auth_account`, `auth_verification`) để không lẫn `auth_session` (đăng nhập) với `sessions` (cuộc họp). Bảng `users` cũ của ta đổi thành `learner_profiles` (khoá `user_id` → `auth_user.id`); mọi cột `user_id` nghiệp vụ tham chiếu `auth_user(id)`. Trên Postgres, Better Auth để DB tự sinh id UUID nên `user_id` giữ kiểu `uuid`; cột của Better Auth giữ camelCase có nháy kép.

`npx auth@latest generate` với adapter Postgres **cần kết nối tới DB đang chạy** (nó đọc schema hiện có), nên migration ban đầu được viết tay theo schema lõi và có **test chống lệch**: `auth.int.test.ts` gọi `getMigrations()` của Better Auth trên DB đã migrate và đòi không còn gì để tạo/thêm. Nâng phiên bản Better Auth → chạy `pnpm test:int`; lệch thì thêm migration mới (không dùng `auth migrate`).

Cấu hình thật nằm ở `services/api/src/modules/auth/`: `auth.ts` (instance), `auth.routes.ts` (mount `/api/auth/*` và `sessionUserId`), `auth.mailer.ts` (dev in link ra log, production từ chối vì chưa có nhà cung cấp email). `magicLink` từ `better-auth/plugins`; Google chỉ bật khi có cả hai khoá; `databaseHooks.user.create.after` tạo dòng `learner_profiles`.

Gắn handler (theo hướng dẫn Fastify của Better Auth): route `GET|POST /api/auth/*` chuyển request Fastify sang `Request` của Fetch (`fromNodeHeaders` từ `better-auth/node`), gọi `auth.handler(req)`, chép status/header/body về `reply`. Đăng ký `@fastify/cors` (origin = `WEB_ORIGIN`, `credentials: true`) **trước** handler.

`src/lib/auth.ts` đổi sang nhận một hàm phân giải người dùng, để test không cần Better Auth:

```ts
export interface AuthOptions {
  resolveUserId: (request: FastifyRequest) => Promise<string | null>;
}
// production (app.ts):
//   resolveUserId: async (req) =>
//     (await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }))?.user.id ?? null
// test: resolveUserId đọc header x-test-user-id
```

Bỏ `allowDevAuth`/`x-dev-user-id` khỏi production. Đường `/api/auth/*` và `/healthz` không qua hook.

## 5. Integration test Postgres

```bash
pnpm --filter @cuelingo/api add -D @testcontainers/postgresql
```

`test/integration/*.int.test.ts`: dựng container `pgvector/pgvector:pg16`, chạy dbmate lên DB đó, test repository Postgres thật (ví dụ `createPostgresGlossaryRepository`) gồm cả ranh giới người dùng. Script riêng `test:int` (không nằm trong `pnpm test` mặc định vì cần Docker); CI chạy nó.

## 6. Dockerfile

`services/api/Dockerfile` nhiều tầng: `turbo prune @cuelingo/api --docker` → `pnpm install --frozen-lockfile` → chạy bằng `tsx src/server.ts` (MVP) trên `node:24-slim`. Không copy `.env` vào image.

## Definition of Done

- [ ] `pnpm db:migrate` dựng đủ bảng trên DB trống; `pnpm db:rollback` lùi được migration cuối.
- [ ] `DATABASE_URL=… pnpm --filter @cuelingo/api dev` → `GET /healthz` 200; đăng nhập Google/magic link trên web tạo được session; `GET /v1/glossary` với cookie session trả dữ liệu của đúng người.
- [ ] `pnpm test` xanh (test HTTP dùng `resolveUserId` giả); `pnpm --filter @cuelingo/api test:int` xanh với Postgres thật.
- [ ] Không còn `x-dev-user-id` trong đường production; `config.ts` là chỗ duy nhất đọc env.
- [ ] `docker build -f services/api/Dockerfile .` thành công.
- [ ] Docs: [data-model](../../03-architecture/07-data-model.md) (bảng auth, `learner_profiles`), [api/auth](../../04-modules/03-api/auth.md), [Tổ chức thư mục](../../03-architecture/03-folder-structure.md).

## Anti-pattern

- ❌ `process.env.X` rải rác trong module.
- ❌ Chạy `auth migrate` hoặc để Better Auth tự tạo bảng ngoài dbmate.
- ❌ Hai bảng người dùng song song (`users` và `user`).
- ❌ Giữ đường tắt header dev trong production "cho tiện test".

## Bài học khi chạy thật (2026-11-01)

Những điều chỉ lộ ra khi chạy với Postgres thật; đã sửa trong code, ghi lại để lần dựng sau khỏi vấp lại:

| Hiện tượng                                                                               | Nguyên nhân                                                          | Cách xử lý                                                                                                                    |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| dbmate: `pq: SSL is not enabled on the server`                                           | dbmate mặc định đòi SSL                                              | `DATABASE_URL` có `?sslmode=disable` ở dev (`pg`, `postgres.js`, pg-boss, dbmate đều hiểu); production dùng `sslmode=require` |
| Magic link trả 500: `invalid input syntax for type uuid`                                 | Better Auth sinh id chuỗi ngẫu nhiên, còn cột là `uuid`              | `advanced.database.generateId: 'uuid'` trong `auth.ts`                                                                        |
| Test integration: lỗi `terminating connection` không bắt được khi dừng container         | Pool `pg` của Better Auth không được đóng                            | Module auth tự tạo pool, có `close()` và `pool.on('error')`; `server.ts` đóng khi shutdown                                    |
| Test integration không khởi động: `Cannot read properties of undefined (reading 'bind')` | `undici` 8 cần Node ≥ 22.19                                          | `engines` ≥ 22.19, `.nvmrc` = 24, CI dùng Node 24                                                                             |
| `pnpm add` báo `ERR_PNPM_UNEXPECTED_STORE`                                               | Cài dependency lúc trong lúc ngoài sandbox dùng store pnpm khác nhau | Chạy `pnpm add/install` **nhất quán một chế độ** (trong sandbox của Claude Code); Docker và server chạy ngoài                 |
