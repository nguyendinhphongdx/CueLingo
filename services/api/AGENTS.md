# AGENTS.md — services/api

Fastify modular monolith. Thiết kế: [apps/docs/docs/04-modules/03-api](../../apps/docs/docs/04-modules/03-api/README.md).

- **Convention:** [api-module](../../apps/docs/docs/05-engineering/conventions/api-module.md) — đọc trước khi code.
- **Module mẫu:** [`src/modules/glossary/`](src/modules/glossary/). Module mới = copy rồi đổi tên (skill `new-module`).
- **Composition root:** `src/app.ts` là nơi duy nhất nối repository → service → routes.
- **Auth:** Better Auth (module `auth`); hook `lib/auth.ts` nhận `resolveUserId`. Test dùng `buildTestApp()` (`src/testing.ts`) với header `x-test-user-id`. Không có đường tắt header trong production.
- **Env:** chỉ `src/config.ts` đọc `process.env`; thêm biến → thêm vào schema **và** `.env.example`.
- **Migration:** dbmate (`pnpm db:new`, `pnpm db:migrate`); migration đã merge thì không sửa. Bảng danh tính `auth_*` do Better Auth sở hữu.
- **Hàng đợi:** API chỉ enqueue qua `lib/queue.ts` (job + payload khai báo ở `@cuelingo/shared/jobs`); worker xử lý.
- **Test:** unit = `buildTestApp` + repository in-memory + `app.inject`; luôn có test ranh giới người dùng. Integration (Postgres thật, cần Docker): `pnpm test:int` (`test/integration/*.int.test.ts`).
- **Chạy:** `cp .env.example .env`, `docker compose -f infra/docker-compose.yml up -d`, `pnpm db:migrate`, `pnpm --filter @cuelingo/api dev`.
- **Scaffold nền móng** (config, dbmate, queue, Better Auth, Docker): [api-foundation](../../apps/docs/docs/05-engineering/scaffold/02-api-foundation.md). **Thêm module:** [new-module](../../apps/docs/docs/05-engineering/workflows/new-module.md).
