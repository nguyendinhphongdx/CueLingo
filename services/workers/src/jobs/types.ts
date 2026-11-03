import {
  JobPayloads,
  type JobEnqueueOptions,
  type JobName,
  type JobPayload,
} from '@cuelingo/shared';
import type { ObjectStorage } from '../lib/storage';
import type { DebriefHandlerDeps } from './debrief/debrief.handler';
import type { StaleSessionsRepository } from './stale-sessions/stale-sessions.repository';
import type { RetentionRepository } from './retention/retention.repository';

/** What a job may do with background jobs: enqueue them (same shape as the API's queue). */
export interface JobQueue {
  enqueue<N extends JobName>(
    name: N,
    payload: JobPayload<N>,
    options?: JobEnqueueOptions,
  ): Promise<void>;
}

/** Everything a handler may touch. Handlers are plain functions of (deps, payload), so tests pass fakes. */
export interface JobDeps extends DebriefHandlerDeps {
  retention: RetentionRepository;
  staleSessions: StaleSessionsRepository;
  queue: JobQueue;
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
    // A cron schedule sends no data (pg-boss hands the handler null); treat that as an empty payload.
    run: async (deps, data) =>
      def.handle(deps, JobPayloads[def.name].parse(data ?? {}) as JobPayload<N>),
  };
}
