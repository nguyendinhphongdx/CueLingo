import { JobName } from '@cuelingo/shared';
import { loadConfig } from '../config';
import { createPgBossQueue } from '../lib/queue';

/**
 * Sends one job to the worker, e.g. `pnpm --filter @cuelingo/api enqueue retention.sweep`.
 * Payload (JSON) is the optional second argument; it is validated against the shared schema.
 */
const [name, payloadArg] = process.argv.slice(2);
const known = Object.values(JobName) as string[];
if (!name || !known.includes(name)) {
  console.error(`Usage: enqueue <job> [payload-json]\nJobs: ${known.join(', ')}`);
  process.exit(1);
}

const queue = await createPgBossQueue(loadConfig().DATABASE_URL);
await queue.enqueue(name as JobName, payloadArg ? JSON.parse(payloadArg) : {});
await queue.stop();
console.warn(`enqueued ${name}`);
