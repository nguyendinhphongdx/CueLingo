# Infra

Local development dependencies: Postgres 16 + pgvector and Redis.

```bash
docker compose -f infra/docker-compose.yml up -d
```

Migrations in `db/migrations/` run automatically on first start. Design: [apps/docs/docs/03-architecture/07-data-model.md](../apps/docs/docs/03-architecture/07-data-model.md)
