# Infra

Local development dependencies: Postgres 16 + pgvector and Redis.

```bash
docker compose -f infra/docker-compose.yml up -d
```

Migrations in `db/migrations/` run automatically on first start. Design: [docs/02-architecture/data-model.md](../docs/02-architecture/data-model.md)
