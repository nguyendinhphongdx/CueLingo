import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LearningPathPanel, type PathCourse, type PathData } from './learning-path-panel';

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
