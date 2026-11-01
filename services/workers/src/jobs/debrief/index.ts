/**
 * Debrief job — Phân tích cuộc họp sau khi kết thúc, tạo debrief JSON.
 * Design: apps/docs/docs/04-modules/04-workers/debrief-job.md
 */
import { JobName } from '@cuelingo/shared';
import { defineJob } from '../types';
import { generateDebrief } from './debrief.handler';

export const debriefGenerate = defineJob({
  name: JobName.DebriefGenerate,
  handle: async (deps, payload) => {
    await generateDebrief(deps, payload);
  },
});

export { generateDebrief, type DebriefHandlerDeps } from './debrief.handler';
export {
  createPostgresDebriefRepository,
  type DebriefRepository,
  type DebriefSegment,
  type DebriefSession,
} from './debrief.repository';
