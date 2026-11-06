# Infra

Local development dependencies: Postgres 16 + pgvector (and Redis, unused so far), plus the optional `sandbox-runner` ([README](sandbox-runner/README.md)).

```bash
cp .env.example .env                              # DATABASE_URL, BETTER_AUTH_SECRET …
docker compose -f infra/docker-compose.yml up -d  # needs Docker Desktop running
pnpm db:migrate                                   # dbmate: apply pending migrations
```

| Command              | What                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm db:new <name>` | New migration `infra/db/migrations/<timestamp>_<name>.sql` (`-- migrate:up` / `-- migrate:down`) |
| `pnpm db:migrate`    | Apply pending migrations (reads `DATABASE_URL` from `.env`)                                      |
| `pnpm db:rollback`   | Revert the last migration (dev only)                                                             |
| `pnpm db:status`     | Show applied and pending migrations                                                              |

A merged migration is never edited; change the schema with a new file. Design: [data model](../apps/docs/docs/03-architecture/07-data-model.md) · decision: [ADR-0009](../apps/docs/docs/08-adr/0009-migrations-dbmate.md).
