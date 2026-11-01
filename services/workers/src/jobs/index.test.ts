import { JobName } from '@cuelingo/shared';
import { describe, expect, it } from 'vitest';
import { jobs } from './index';

describe('job registry', () => {
  it('registers each job once, under a name from the shared catalog', () => {
    const names = jobs.map((j) => j.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(Object.values(JobName)).toContain(name);
  });
});
