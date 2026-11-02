// A throwaway Postgres for the end-to-end run, migrated to the latest schema. Safe to run again:
// it recreates the database so every run starts empty. CI uses a service container instead.
import { spawnSync } from 'node:child_process';

const DB_URL =
  process.env.E2E_DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5544/cuelingo_e2e?sslmode=disable';
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  }
  return result;
};

if (!process.env.E2E_DATABASE_URL) {
  const running = run('docker', ['ps', '-q', '-f', 'name=cuelingo-e2e-pg']).stdout.trim();
  if (!running) {
    run('docker', ['rm', '-f', 'cuelingo-e2e-pg'], { allowFailure: true });
    run('docker', [
      'run',
      '-d',
      '--name',
      'cuelingo-e2e-pg',
      '-p',
      '5544:5432',
      '-e',
      'POSTGRES_PASSWORD=postgres',
      '-e',
      'POSTGRES_DB=cuelingo_e2e',
      'pgvector/pgvector:pg16',
    ]);
  }
  for (let i = 0; i < 60; i += 1) {
    if (
      run('docker', ['exec', 'cuelingo-e2e-pg', 'pg_isready', '-U', 'postgres'], {
        allowFailure: true,
      }).status === 0
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
// Drop and recreate so a previous run's data never leaks in.
run(
  'pnpm',
  ['exec', 'dbmate', '--migrations-dir', 'infra/db/migrations', '--no-dump-schema', 'drop'],
  {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, DATABASE_URL: DB_URL },
    allowFailure: true,
  },
);
run(
  'pnpm',
  ['exec', 'dbmate', '--migrations-dir', 'infra/db/migrations', '--no-dump-schema', 'up'],
  {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, DATABASE_URL: DB_URL },
  },
);
console.warn('e2e database ready');
