/**
 * retention.sweep — daily removal of saved audio older than the retention window.
 * REFERENCE JOB for services/workers: copy this folder's shape for new jobs.
 * Design: apps/docs/docs/04-modules/04-workers/retention.md
 */
import { JobName } from '@cuelingo/shared';
import { defineJob } from '../types';
import { sweepDeletedSessions, sweepExpiredAudio } from './retention.handler';

export const retentionSweep = defineJob({
  name: JobName.RetentionSweep,
  schedule: '15 3 * * *', // 03:15 UTC every day
  handle: async (deps) => {
    await sweepExpiredAudio(deps);
    await sweepDeletedSessions(deps);
  },
});

export {
  sweepDeletedSessions,
  sweepExpiredAudio,
  AUDIO_RETENTION_DAYS,
  DELETED_SESSION_RETENTION_DAYS,
} from './retention.handler';
export {
  createPostgresRetentionRepository,
  type RetentionRepository,
} from './retention.repository';
