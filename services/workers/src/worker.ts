import { createAiGateway } from '@cuelingo/ai-gateway';
import { PgBoss } from 'pg-boss';
import { loadConfig } from './config';
import { jobs } from './jobs';
import { createPostgresDebriefRepository } from './jobs/debrief';
import { createPostgresRetentionRepository } from './jobs/retention';
import type { JobDeps } from './jobs/types';
import { createSql } from './lib/db';
import { createUnconfiguredStorage } from './lib/storage';

const config = loadConfig();
const sql = createSql(config.DATABASE_URL);

const deps: JobDeps = {
  debrief: createPostgresDebriefRepository(sql),
  ai: config.GEMINI_API_KEY
    ? createAiGateway({
        googleApiKey: config.GEMINI_API_KEY,
        onCall: ({ task, model, latencyMs }) =>
          console.warn('worker: AI call completed', { task, model, latencyMs }),
      })
    : undefined,
  log: { warn: (message, context) => console.warn(message, context) },
  retention: createPostgresRetentionRepository(sql),
  storage: createUnconfiguredStorage(),
  now: () => new Date(),
};

const boss = new PgBoss(config.DATABASE_URL);
boss.on('error', (err) => console.error('pg-boss', err));
await boss.start();

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
