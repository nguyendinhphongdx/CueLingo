import { describe, expect, it } from 'vitest';
import { JobName, JobPayloads } from './jobs';

describe('JobPayloads', () => {
  it('has a payload schema for every job name', () => {
    for (const name of Object.values(JobName)) expect(JobPayloads[name]).toBeDefined();
  });

  it('requires a session id for debrief.generate', () => {
    expect(JobPayloads[JobName.DebriefGenerate].safeParse({}).success).toBe(false);
    expect(
      JobPayloads[JobName.DebriefGenerate].safeParse({
        sessionId: '6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f',
      }).success,
    ).toBe(true);
  });
});
