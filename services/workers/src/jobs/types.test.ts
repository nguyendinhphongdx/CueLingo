import { JobName } from '@cuelingo/shared';
import { describe, expect, it } from 'vitest';
import { defineJob, type JobDeps } from './types';

const deps = {} as JobDeps;

describe('defineJob', () => {
  it('parses the payload with the shared schema before calling the handler', async () => {
    const seen: string[] = [];
    const job = defineJob({
      name: JobName.DebriefGenerate,
      handle: async (_deps, payload) => {
        seen.push(payload.sessionId);
      },
    });

    await job.run(deps, { sessionId: '6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f' });

    expect(seen).toEqual(['6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f']);
  });

  it('rejects a malformed payload without running the handler', async () => {
    let called = false;
    const job = defineJob({
      name: JobName.DebriefGenerate,
      handle: async () => {
        called = true;
      },
    });

    await expect(job.run(deps, { sessionId: 'not-a-uuid' })).rejects.toThrow();
    expect(called).toBe(false);
  });
});
