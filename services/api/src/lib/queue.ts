import { JobName, JobPayloads, type JobEnqueueOptions, type JobPayload } from '@cuelingo/shared';
import { PgBoss } from 'pg-boss';

/** What the API can do with background jobs: enqueue them. Workers consume (services/workers). */
export interface JobQueue {
  enqueue<N extends JobName>(
    name: N,
    payload: JobPayload<N>,
    options?: JobEnqueueOptions,
  ): Promise<void>;
}

export interface PgBossQueue extends JobQueue {
  stop(): Promise<void>;
}

export async function createPgBossQueue(databaseUrl: string): Promise<PgBossQueue> {
  const boss = new PgBoss(databaseUrl);
  boss.on('error', (err) => console.error('pg-boss', err));
  await boss.start();
  // pg-boss 12: a queue must exist before send/work.
  for (const name of Object.values(JobName)) await boss.createQueue(name);

  return {
    async enqueue(name, payload, options) {
      await boss.send(name, JobPayloads[name].parse(payload), { ...options });
    },
    stop: () => boss.stop(),
  };
}

/** Records jobs instead of sending them. Used by tests. */
export function createInMemoryQueue(): JobQueue & {
  jobs: Array<{ name: JobName; payload: unknown }>;
} {
  const keys = new Set<string>();
  const jobs: Array<{ name: JobName; payload: unknown }> = [];
  return {
    jobs,
    async enqueue(name, payload, options) {
      // Like pg-boss singletonKey: a repeat of a still-throttled key is dropped.
      if (options?.singletonKey) {
        const key = `${name}:${options.singletonKey}`;
        if (keys.has(key)) return;
        keys.add(key);
      }
      jobs.push({ name, payload: JobPayloads[name].parse(payload) });
    },
  };
}
