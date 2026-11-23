// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queue, courseList, goalList } = vi.hoisted(() => ({
  queue: vi.fn(),
  courseList: vi.fn(),
  goalList: vi.fn(),
}));
vi.mock('../../lib/client', () => ({
  client: { courses: { queue, list: courseList }, goals: { list: goalList } },
}));

import { LearningPathTab } from './LearningPathTab';
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

const GOAL_ID = '5f2b9a52-6a4e-4d1e-9a52-1f7a7a3b9c10';
const goalData = {
  goals: [
    {
      id: GOAL_ID,
      goalKey: 'standup',
      titleVi: 'Họp stand-up hằng ngày',
      language: 'en',
      level: 'b1',
      deadline: null,
      createdAt: '2026-11-22T00:00:00.000Z',
      lessonCount: 6,
      doneCount: 0,
      progressPct: 0,
      lessons: [
        { lessonKey: 'done', titleVi: 'Báo việc đã làm', status: 'todo', bestCorrect: null },
      ],
    },
  ],
  nextUp: {
    goalId: GOAL_ID,
    goalTitleVi: 'Họp stand-up hằng ngày',
    lessonKey: 'done',
    lessonTitleVi: 'Báo việc đã làm',
  },
};

async function mount(language: 'en' | 'ja') {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <LearningPathTab language={language} renderSitting={() => null} />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return { container, unmount: () => act(() => root.unmount()) };
}

describe('goals in the learning path (AC8)', () => {
  beforeEach(() => {
    courseList.mockReset().mockResolvedValue({ courses: [], nextUp: null });
    goalList.mockReset().mockResolvedValue(goalData);
  });

  it('shows the goals of an English learner with their next lesson', async () => {
    const { container, unmount } = await mount('en');
    expect(container.textContent).toContain('Mục tiêu của bạn');
    expect(container.textContent).toContain('Họp stand-up hằng ngày');
    expect(container.textContent).toContain('Học bài này');
    expect(container.textContent).toContain('Thêm mục tiêu');
    await unmount();
  });

  it('does not ask for goals in another language', async () => {
    const { container, unmount } = await mount('ja');
    expect(goalList).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('Mục tiêu của bạn');
    await unmount();
  });

  it('keeps the courses when the goals cannot load', async () => {
    goalList.mockRejectedValue(new Error('down'));
    courseList.mockResolvedValue({
      courses: [
        {
          sessionId: '3f2b9a52-6a4e-4d1e-9a52-1f7a7a3b9c10',
          headline: 'Họp sprint',
          startedAt: '2026-11-20T00:00:00.000Z',
          language: 'en',
          lessonCount: 4,
          doneCount: 1,
          progressPct: 25,
          unsavedCount: 0,
        },
      ],
      nextUp: null,
    });
    const { container, unmount } = await mount('en');
    expect(container.textContent).toContain('Họp sprint');
    expect(container.textContent).toContain('Chưa tải được mục tiêu');
    await unmount();
  });
});
