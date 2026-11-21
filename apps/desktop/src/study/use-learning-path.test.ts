import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queue } = vi.hoisted(() => ({ queue: vi.fn() }));
vi.mock('./courses-api', () => ({ coursesApi: { queue } }));

import { courseQueueSource } from './use-learning-path';

describe('course sittings on desktop (AC5)', () => {
  beforeEach(() => queue.mockReset());

  it('loads the cards of one course as a review queue, with dictation on', async () => {
    queue.mockResolvedValue({ dueCount: 2, cards: [] });
    const source = courseQueueSource('3f2b9a52-6a4e-4d1e-9a52-1f7a7a3b9c10');
    expect(await source.load()).toEqual({ dueCount: 2, cards: [] });
    expect(queue).toHaveBeenCalledWith('3f2b9a52-6a4e-4d1e-9a52-1f7a7a3b9c10', {
      dictation: true,
    });
  });

  it('keeps one cache key per course', () => {
    expect(courseQueueSource('a').key).not.toEqual(courseQueueSource('b').key);
  });
});
