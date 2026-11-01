// Same helper as services/api/test/integration/postgres.ts (kept separate: services never import each other).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

const MIGRATIONS_DIR = fileURLToPath(new URL('../../../../infra/db/migrations', import.meta.url));

export interface TestDatabase {
  url: string;
  container: StartedPostgreSqlContainer;
  stop(): Promise<void>;
}

/** Real Postgres + pgvector in Docker. Migrations are applied separately so tests can check them. */
export async function startPostgres(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer('pgvector/pgvector:pg16').start();
  return {
    url: container.getConnectionUri(),
    container,
    stop: () => container.stop().then(() => undefined),
  };
}

export type DbmateCommand = 'up' | 'rollback' | 'status';

export function dbmate(url: string, command: DbmateCommand): string {
  return execFileSync(
    'pnpm',
    [
      'exec',
      'dbmate',
      '--url',
      `${url}?sslmode=disable`,
      '--migrations-dir',
      MIGRATIONS_DIR,
      '--no-dump-schema',
      command,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

/** A migrated database ready for repository and flow tests. */
export async function startMigratedPostgres(): Promise<TestDatabase> {
  const db = await startPostgres();
  dbmate(db.url, 'up');
  return db;
}
