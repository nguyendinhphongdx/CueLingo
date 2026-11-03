import { createAiGateway } from '@cuelingo/ai-gateway';
import { JobPayloads } from '@cuelingo/shared';
import { PgBoss } from 'pg-boss';
import { loadConfig } from './config';
import { jobs } from './jobs';
import { createPostgresDebriefRepository } from './jobs/debrief';
import { createPostgresRetentionRepository } from './jobs/retention';
import { createPostgresStaleSessionsRepository } from './jobs/stale-sessions';
import type { JobDeps } from './jobs/types';
import { createSql } from './lib/db';
import { createUnconfiguredStorage } from './lib/storage';
import { createAiCallHook } from './lib/ai-calls';

const config = loadConfig();
const sql = createSql(config.DATABASE_URL);

const boss = new PgBoss(config.DATABASE_URL);
boss.on('error', (err) => console.error('pg-boss', err));
await boss.start();

const deps: JobDeps = {
  debrief: createPostgresDebriefRepository(sql),
  ai: config.GEMINI_API_KEY
    ? createAiGateway({
        googleApiKey: config.GEMINI_API_KEY,
        onCall: createAiCallHook(sql, (error, record) =>
          console.error('worker: AI call metrics persistence failed', {
            error,
            task: record.task,
            model: record.model,
          }),
        ),
      })
    : undefined,
  log: { warn: (message, context) => console.warn(message, context) },
  retention: createPostgresRetentionRepository(sql),
  staleSessions: createPostgresStaleSessionsRepository(sql),
  queue: {
    async enqueue(name, payload, options) {
      await boss.send(name, JobPayloads[name].parse(payload), { ...options });
    },
  },
  storage: createUnconfiguredStorage(),
  now: () => new Date(),
};

for (const job of jobs) {
  // pg-boss 12: a queue must exist before work/schedule.
  await boss.createQueue(job.name);
  if (job.schedule) await boss.schedule(job.name, job.schedule);
  // The handler receives an ARRAY of jobs; a throw makes pg-boss retry.
  await boss.work(job.name, async (batch) => {
    for (const item of batch) await job.run(deps, item.data);
  });
  console.warn(`worker: registered ${job.name}${job.schedule ? ` (cron ${job.schedule})` : ''}`);
}

const shutdown = async () => {
  await boss.stop();
  await sql.end();
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
