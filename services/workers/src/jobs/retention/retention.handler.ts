import type { JobDeps } from '../types';

/** Saved audio is removed this many days after the meeting started (docs: security & privacy). */
export const AUDIO_RETENTION_DAYS = 30;
export const DELETED_SESSION_RETENTION_DAYS = 7;
const BATCH_SIZE = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes expired audio objects, then forgets their keys. Idempotent: a crash between the two
 * steps only means the next run deletes again (object deletion is idempotent) and then clears.
 */
export async function sweepExpiredAudio(deps: Pick<JobDeps, 'retention' | 'storage' | 'now'>) {
  const cutoff = new Date(deps.now().getTime() - AUDIO_RETENTION_DAYS * DAY_MS);
  let removed = 0;

  for (;;) {
    const batch = await deps.retention.findExpiredAudio(cutoff, BATCH_SIZE);
    if (batch.length === 0) return { removed };
    await deps.storage.deleteMany(batch.map((b) => b.audioKey));
    await deps.retention.clearAudioKeys(batch.map((b) => b.segmentId));
    removed += batch.length;
  }
}

/** Permanently removes sessions after the seven-day recovery window. Cascades remove their data. */
export async function sweepDeletedSessions(deps: Pick<JobDeps, 'retention' | 'now'>) {
  const cutoff = new Date(deps.now().getTime() - DELETED_SESSION_RETENTION_DAYS * DAY_MS);
  let removed = 0;
  for (;;) {
    const batchRemoved = await deps.retention.deleteExpiredSessions(cutoff, BATCH_SIZE);
    removed += batchRemoved;
    if (batchRemoved < BATCH_SIZE) return { removed };
  }
}
