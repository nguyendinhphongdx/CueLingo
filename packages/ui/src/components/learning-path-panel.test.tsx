import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  LearningPathPanel,
  type PathCourse,
  type PathData,
  type PathGoals,
} from './learning-path-panel';

const course = (overrides: Partial<PathCourse> = {}): PathCourse => ({
  sessionId: '3f2b9a52-6a4e-4d1e-9a52-1f7a7a3b9c10',
  headline: 'Họp sprint',
  lessonCount: 4,
  doneCount: 1,
  progressPct: 25,
  unsavedCount: 0,
  ...overrides,
});

const render = (data: PathData | undefined, extra: object = {}) =>
  renderToStaticMarkup(
    <LearningPathPanel data={data} onStart={vi.fn()} onContinue={vi.fn()} {...extra} />,
  );

describe('LearningPathPanel (AC6)', () => {
  it('shows what to do next and every course with its progress', () => {
    const markup = render({
      courses: [
        course(),
        course({
          sessionId: '4f2b9a52-6a4e-4d1e-9a52-1f7a7a3b9c11',
          headline: 'Họp khách',
          progressPct: 100,
          doneCount: 4,
        }),
      ],
      nextUp: {
        sessionId: '3f2b9a52-6a4e-4d1e-9a52-1f7a7a3b9c10',
        headline: 'Họp sprint',
        phrase: 'touch base',
        saved: true,
      },
    });
    expect(markup).toContain('Việc nên làm tiếp');
    expect(markup).toContain('touch base');
    expect(markup).toContain('Khoá của bạn');
    expect(markup).toContain('1/4 bài xong');
    expect(markup).toContain('aria-valuenow="25"');
    expect(markup).toContain('Học tiếp');
    expect(markup).toContain('Đã xong');
  });

  it('says how many phrases starting a course adds to the Phrase Bank', () => {
    const markup = render({
      courses: [course({ unsavedCount: 3, doneCount: 0, progressPct: 0 })],
      nextUp: null,
    });
    expect(markup).toContain('Bắt đầu khoá · thêm 3 cụm vào Kho cụm từ');
    expect(markup).not.toContain('Việc nên làm tiếp');
  });

  it('explains an empty list, a load and an error in Vietnamese', () => {
    expect(render({ courses: [], nextUp: null })).toContain('Chưa có khoá nào');
    expect(render(undefined)).toContain('Đang tải lộ trình');
    const failed = render(undefined, { error: 'Không tải được lộ trình.' });
    expect(failed).toContain('Không tải được lộ trình.');
    expect(failed).toContain('role="alert"');
  });

  it('disables the button of the course being fetched', () => {
    const markup = render(
      { courses: [course()], nextUp: null },
      { busySessionId: '3f2b9a52-6a4e-4d1e-9a52-1f7a7a3b9c10' },
    );
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Học tiếp/);
  });

  it('keeps the list and shows the error when starting a course failed', () => {
    const markup = render(
      { courses: [course({ unsavedCount: 2, doneCount: 0, progressPct: 0 })], nextUp: null },
      { actionError: 'Không thể bắt đầu khoá. Hãy thử lại.' },
    );
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Không thể bắt đầu khoá');
    expect(markup).toContain('Khoá của bạn');
    expect(markup).toContain('Bắt đầu khoá · thêm 2 cụm vào Kho cụm từ');
  });
});

const goals = (overrides: Partial<PathGoals['goals'][number]> = {}): PathGoals => ({
  goals: [
    {
      id: '5f2b9a52-6a4e-4d1e-9a52-1f7a7a3b9c10',
      titleVi: 'Họp stand-up hằng ngày',
      level: 'b1',
      deadline: '2026-12-01',
      lessonCount: 6,
      doneCount: 1,
      progressPct: 17,
      lessons: [
        { lessonKey: 'done', titleVi: 'Báo việc đã làm', status: 'done', bestCorrect: 5 },
        { lessonKey: 'plan', titleVi: 'Kế hoạch hôm nay', status: 'learning', bestCorrect: null },
        { lessonKey: 'blocker', titleVi: 'Báo vướng mắc', status: 'todo', bestCorrect: null },
      ],
      ...overrides,
    },
  ],
  nextUp: {
    goalId: '5f2b9a52-6a4e-4d1e-9a52-1f7a7a3b9c10',
    goalTitleVi: 'Họp stand-up hằng ngày',
    lessonKey: 'plan',
    lessonTitleVi: 'Kế hoạch hôm nay',
  },
});

describe('LearningPathPanel with goals (AC8)', () => {
  const meeting: PathData = {
    courses: [course()],
    nextUp: {
      sessionId: '3f2b9a52-6a4e-4d1e-9a52-1f7a7a3b9c10',
      headline: 'Họp sprint',
      phrase: 'touch base',
      saved: true,
    },
  };
  const open = vi.fn();

  it('shows the goals and the meeting courses side by side, with both next steps', () => {
    const markup = render(meeting, { goals: goals(), onOpenLesson: open, onAddGoal: vi.fn() });
    expect(markup).toContain('Việc nên làm tiếp');
    expect(markup).toContain('Học bài này');
    expect(markup).toContain('Kế hoạch hôm nay');
    expect(markup).toContain('touch base');
    expect(markup).toContain('Mục tiêu của bạn');
    expect(markup).toContain('Khoá của bạn');
    expect(markup).toContain('1/6 bài xong');
    expect(markup).toContain('Trung cấp (B1)');
    expect(markup).toContain('Hạn 01/12/2026');
    expect(markup).toContain('aria-valuenow="17"');
    expect(markup).toContain('Đã xong');
    expect(markup).toContain('Đang học');
    expect(markup).toContain('Chưa học');
    expect(markup).toContain('Thêm mục tiêu');
    expect(markup).toContain('Bài học do AI soạn, có thể sai');
  });

  it('shows goals when there is no course from a meeting', () => {
    const markup = render({ courses: [], nextUp: null }, { goals: goals(), onOpenLesson: open });
    expect(markup).toContain('Mục tiêu của bạn');
    expect(markup).not.toContain('Khoá của bạn');
    expect(markup).not.toContain('Chưa có khoá nào');
  });

  it('offers to pick a goal when there is nothing at all', () => {
    const markup = render(
      { courses: [], nextUp: null },
      { goals: { goals: [], nextUp: null }, onAddGoal: vi.fn() },
    );
    expect(markup).toContain('Chưa có khoá nào');
    expect(markup).toContain('Chọn mục tiêu');
  });

  it('stops offering new goals at three', () => {
    const three = goals();
    three.goals = [0, 1, 2].map((n) => ({ ...three.goals[0]!, id: `id-${n}` }));
    expect(render(meeting, { goals: three, onAddGoal: vi.fn() })).not.toContain('Thêm mục tiêu');
  });

  it('keeps the old panel unchanged when goals are not offered', () => {
    const markup = render(meeting);
    expect(markup).not.toContain('Mục tiêu của bạn');
    expect(markup).toContain('Khoá của bạn');
  });

  it('shows a goal action error in Vietnamese', () => {
    expect(
      render(meeting, { goals: goals(), goalError: 'Chưa lưu được mục tiêu. Thử lại sau.' }),
    ).toContain('Chưa lưu được mục tiêu');
  });
});
