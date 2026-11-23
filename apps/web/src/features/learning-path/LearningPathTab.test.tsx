import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queue } = vi.hoisted(() => ({ queue: vi.fn() }));
vi.mock('../../lib/client', () => ({ client: { courses: { queue } } }));

import { courseQueueSource } from './use-learning-path';

describe('course sittings (AC5)', () => {
  beforeEach(() => queue.mockReset());

  it('loads the cards of one course as a review queue, with dictation on', async () => {
    queue.mockResolvedValue({ dueCount: 1, cards: [] });
    const source = courseQueueSource('3f2b9a52-6a4e-4d1e-9a52-1f7a7a3b9c10');
    expect(await source.load()).toEqual({ dueCount: 1, cards: [] });
    expect(queue).toHaveBeenCalledWith('3f2b9a52-6a4e-4d1e-9a52-1f7a7a3b9c10', {
      dictation: true,
    });
  });

  it('keeps the queue of each course under its own cache key', () => {
    expect(courseQueueSource('a').key).not.toEqual(courseQueueSource('b').key);
    expect(courseQueueSource('a').key[0]).toBe('courses');
  });
});
