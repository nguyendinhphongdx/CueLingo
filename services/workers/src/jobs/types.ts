import { JobPayloads, type JobName, type JobPayload } from '@cuelingo/shared';
import type { ObjectStorage } from '../lib/storage';
import type { RetentionRepository } from './retention/retention.repository';

/** Everything a handler may touch. Handlers are plain functions of (deps, payload), so tests pass fakes. */
export interface JobDeps {
  retention: RetentionRepository;
  storage: ObjectStorage;
  now: () => Date;
}

/** A job as the worker runs it: payload already parsed by the schema in @cuelingo/shared. */
export interface RegisteredJob {
  name: JobName;
  /** Cron expression (UTC). Omit for jobs only enqueued by the API. */
  schedule?: string;
  run(deps: JobDeps, data: unknown): Promise<void>;
}

export function defineJob<N extends JobName>(def: {
  name: N;
  schedule?: string;
  handle: (deps: JobDeps, payload: JobPayload<N>) => Promise<void>;
}): RegisteredJob {
  return {
    name: def.name,
    schedule: def.schedule,
    // async: a malformed payload must surface as a rejected promise, never a synchronous throw.
    run: async (deps, data) => def.handle(deps, JobPayloads[def.name].parse(data) as JobPayload<N>),
  };
}
