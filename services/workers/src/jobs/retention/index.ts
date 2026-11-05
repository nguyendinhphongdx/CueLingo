/**
 * retention.sweep — daily removal of saved audio older than the retention window.
 * REFERENCE JOB for services/workers: copy this folder's shape for new jobs.
 * Design: apps/docs/docs/04-modules/04-workers/retention.md
 */
import { JobName } from '@cuelingo/shared';
import { defineJob } from '../types';
import {
  sweepDeletedConversations,
  sweepDeletedSessions,
  sweepExpiredAudio,
  sweepStaleStreamingMessages,
} from './retention.handler';

export const retentionSweep = defineJob({
  name: JobName.RetentionSweep,
  schedule: '15 3 * * *', // 03:15 UTC every day
  handle: async (deps) => {
    await sweepExpiredAudio(deps);
    await sweepDeletedSessions(deps);
    await sweepDeletedConversations(deps);
    await sweepStaleStreamingMessages(deps);
  },
});

export {
  sweepDeletedConversations,
  sweepDeletedSessions,
  sweepExpiredAudio,
  sweepStaleStreamingMessages,
  AUDIO_RETENTION_DAYS,
  DELETED_CONVERSATION_RETENTION_DAYS,
  DELETED_SESSION_RETENTION_DAYS,
  STALE_STREAMING_MINUTES,
} from './retention.handler';
export {
  createPostgresRetentionRepository,
  type RetentionRepository,
} from './retention.repository';
