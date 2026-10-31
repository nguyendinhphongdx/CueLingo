# CLAUDE.md — services/api

Fastify modular monolith. Thiết kế: [docs/03-parts/api](../../docs/03-parts/api/README.md).

- **Convention:** [api-module](../../docs/05-engineering/conventions/api-module.md) — đọc trước khi code.
- **Module mẫu:** [`src/modules/glossary/`](src/modules/glossary/). Module mới = copy rồi đổi tên (skill `new-module`).
- **Composition root:** `src/app.ts` là nơi duy nhất nối repository → service → routes.
- **Auth tạm:** header `x-dev-user-id` chỉ chạy khi `allowDevAuth` (dev/test). Thay bằng module `auth` trước beta.
- **Test:** `buildApp` + repository in-memory + `app.inject`; luôn có test ranh giới người dùng.
- **Chạy:** `DATABASE_URL=… DEV_AUTH=1 pnpm --filter @cuelingo/api dev` (cần `infra/docker-compose.yml`).
