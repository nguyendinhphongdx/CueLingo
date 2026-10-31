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

Việc chuyển đổi:

1. Đổi `0001_init.sql` thành `<timestamp>_init.sql` có `-- migrate:up` / `-- migrate:down`. File này chưa chạy ở đâu nên được phép sửa — **lần duy nhất**.
2. Bỏ mount `./db/migrations:/docker-entrypoint-initdb.d` trong `infra/docker-compose.yml`: migration chỉ chạy bằng `pnpm db:migrate`.
3. CI: dựng Postgres service, chạy `pnpm db:migrate` trước integration test.

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

**Dữ liệu:** Better Auth sở hữu bảng định danh (`user`, `session`, `account`, `verification`). Bảng `users` của ta đổi thành `learner_profiles` (khoá `user_id` → `user.id`); mọi cột `user_id` của bảng nghiệp vụ tham chiếu `user.id`. Sinh schema bằng `npx auth@latest generate`, **chép SQL vào một migration dbmate** (không dùng `auth migrate`). Kiểm kiểu id mà schema sinh ra (chuỗi hay UUID) và cho cột `user_id` khớp.

`src/modules/auth/auth.ts`:

```ts
import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins'; // xác nhận đường import trong tài liệu plugin
import { Pool } from 'pg';
import type { Config } from '../../config';

export function createAuth(config: Config) {
  return betterAuth({
    database: new Pool({ connectionString: config.DATABASE_URL }),
    secret: config.BETTER_AUTH_SECRET,
    baseURL: config.BETTER_AUTH_URL,
    trustedOrigins: [config.WEB_ORIGIN],
    socialProviders: { google: { clientId: '…', clientSecret: '…' } }, // từ config
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          /* gửi email */
        },
      }),
    ],
  });
}
```

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
