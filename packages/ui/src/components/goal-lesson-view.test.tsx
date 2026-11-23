// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GoalLessonView,
  type GoalLessonViewProps,
  type LessonViewData,
  type QuizResultData,
} from './goal-lesson-view';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const lesson: LessonViewData = {
  lessonKey: 'done',
  titleVi: 'Báo việc đã làm',
  level: 'b1',
  situation: {
    descriptionVi: 'Bạn đang ở buổi họp stand-up sáng.',
    keyPhrases: [
      'I finished',
      'I worked on',
      'I fixed the bug in',
      'It is ready',
      'Still working',
    ].map((en, n) => ({ en, meaningVi: `nghĩa ${n}`, register: 'neutral' })),
  },
  dialogue: {
    roles: { a: 'Team lead', b: 'Developer' },
    turns: [
      { speaker: 'a', en: 'What did you do yesterday?', vi: 'Hôm qua bạn làm gì?' },
      { speaker: 'b', en: 'I finished the login page.', vi: 'Tôi đã xong trang đăng nhập.' },
    ],
  },
  practice: {
    prompts: [
      { taskVi: 'Báo bạn đã xong trang hồ sơ.', targetPhrase: 'I finished', hintEn: 'profile' },
      { taskVi: 'Nói bạn sửa lỗi giỏ hàng.', targetPhrase: 'I fixed the bug in' },
      { taskVi: 'Nói bạn vẫn đang làm báo cáo.', targetPhrase: 'Still working' },
    ],
  },
  quiz: {
    questions: Array.from({ length: 6 }, (_, n) => ({
      kind: 'choice',
      prompt: `Câu hỏi ${n + 1}`,
      options: [`đúng ${n}`, `sai ${n}`, `khác ${n}`],
    })),
  },
  examples: [
    { en: 'I finished the sprint review notes.', vi: 'Tôi xong ghi chú.', term: 'sprint review' },
  ],
  bestCorrect: null,
};

const result = (correct: number): QuizResultData => ({
  correct,
  total: 6,
  passed: correct >= 4,
  passMark: 4,
  bestCorrect: correct,
  results: Array.from({ length: 6 }, (_, question) => ({
    question,
    correct: question < correct,
    answerIndex: 0,
    explanationVi: `Giải thích ${question + 1}`,
  })),
  phrasesAdded: 5,
});

function setup(overrides: Partial<GoalLessonViewProps> = {}) {
  const props: GoalLessonViewProps = {
    lesson,
    loadAudio: vi.fn(async () => new Blob(['x'])),
    onPractice: vi.fn(async () => ({
      verdict: 'minor',
      grammarVi: 'Dùng thì quá khứ.',
      better: 'I finished the profile page.',
      register: 'neutral',
    })),
    onSubmitQuiz: vi.fn(async () => result(4)),
    onReport: vi.fn(async () => undefined),
    ...overrides,
  };
  render(<GoalLessonView {...props} />);
  return props;
}

const pickAll = (index = 0) => {
  for (let question = 0; question < 6; question += 1) {
    fireEvent.click(
      screen.getAllByRole('radio', { name: new RegExp(`^(đúng|sai|khác) ${question}$`) })[index]!,
    );
  }
};

describe('GoalLessonView (AC3)', () => {
  it('shows the four parts in order', () => {
    setup();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      '1. Tình huống và mẫu câu',
      '2. Hội thoại mẫu',
      '3. Luyện câu của bạn',
      '4. Kiểm tra cuối bài',
    ]);
    expect(screen.getByText('Bạn đang ở buổi họp stand-up sáng.')).toBeTruthy();
    expect(screen.getByText('I finished the login page.')).toBeTruthy();
    expect(screen.getByText('Ví dụ với thuật ngữ của bạn')).toBeTruthy();
    expect(screen.getAllByText(/Bài học do AI soạn, có thể sai/).length).toBeGreaterThan(0);
  });

  it('puts an audio button on every dialogue line and key phrase', () => {
    setup();
    expect(screen.getAllByRole('button', { name: 'Nghe phát âm' })).toHaveLength(5 + 2);
  });

  it('plays each speaker with a fixed voice', async () => {
    const loadAudio = vi.fn(async () => new Blob(['x']));
    // `Audio` is not in jsdom; the load happens before it is used.
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x' });
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    setup({ loadAudio });
    const buttons = screen.getAllByRole('button', { name: 'Nghe phát âm' });
    fireEvent.click(buttons[5]!);
    await waitFor(() =>
      expect(loadAudio).toHaveBeenCalledWith('What did you do yesterday?', 'Kore'),
    );
    fireEvent.click(buttons[6]!);
    await waitFor(() =>
      expect(loadAudio).toHaveBeenCalledWith('I finished the login page.', 'Puck'),
    );
  });

  it('says what is being made, and a failure in Vietnamese with a retry', () => {
    const noop = vi.fn();
    const { unmount } = render(
      <GoalLessonView
        lesson={undefined}
        loading
        loadAudio={noop}
        onPractice={noop}
        onSubmitQuiz={noop}
        onReport={noop}
      />,
    );
    expect(screen.getAllByText(/Đang soạn bài/).length).toBeGreaterThan(0);
    unmount();
    const onRetry = vi.fn();
    render(
      <GoalLessonView
        lesson={undefined}
        error="Bài mới chưa soạn được."
        onRetry={onRetry}
        loadAudio={vi.fn()}
        onPractice={vi.fn()}
        onSubmitQuiz={vi.fn()}
        onReport={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Bài mới chưa soạn được');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('practice (AC6)', () => {
  it('sends the sentence, shows the feedback and warns that it goes to Gemini', async () => {
    const props = setup();
    expect(
      screen.getAllByText(/gửi tới Google Gemini để góp ý và không được lưu lại/),
    ).toHaveLength(3);
    const box = screen.getAllByPlaceholderText('Gõ câu tiếng Anh của bạn')[0]!;
    const send = screen.getAllByRole('button', { name: 'Nhận góp ý' })[0] as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(box, { target: { value: 'I finish the profile page.' } });
    fireEvent.click(send);
    await waitFor(() => expect(screen.getByText('I finished the profile page.')).toBeTruthy());
    expect(props.onPractice).toHaveBeenCalledWith(0, 'I finish the profile page.');
    expect(screen.getByText('Dùng thì quá khứ.')).toBeTruthy();
    expect(screen.getByText('Gần đúng, có thể tốt hơn')).toBeTruthy();
    expect(screen.getByText(/Mức trang trọng: Trung tính/)).toBeTruthy();
  });

  it('shows the message of a failure and lets the person try again', async () => {
    const onPractice = vi.fn().mockRejectedValue(new Error('Bạn đã dùng hết lượt góp ý hôm nay.'));
    setup({ onPractice });
    fireEvent.change(screen.getAllByPlaceholderText('Gõ câu tiếng Anh của bạn')[1]!, {
      target: { value: 'I fixed it' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Nhận góp ý' })[1]!);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('hết lượt góp ý'));
  });
});

describe('quiz (AC7)', () => {
  it('keeps submit off until every question is answered, then shows the result and explanations', async () => {
    const props = setup();
    const submit = screen.getByRole('button', { name: 'Nộp bài' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    pickAll();
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() =>
      expect(screen.getByText(/Đúng 4\/6\. Bạn đã hoàn thành bài này\./)).toBeTruthy(),
    );
    expect(props.onSubmitQuiz).toHaveBeenCalledWith(
      Array.from({ length: 6 }, (_, question) => ({ question, choice: 0 })),
    );
    expect(screen.getByText('Giải thích 1')).toBeTruthy();
    expect(screen.getByText('Đã thêm 5 cụm vào Kho cụm từ để ôn.')).toBeTruthy();
    expect(screen.getByText('Điểm cao nhất: 4/6')).toBeTruthy();
  });

  it('says what is needed to pass, and a retake starts clean with the options in another order', async () => {
    setup({ onSubmitQuiz: vi.fn(async () => result(3)) });
    pickAll();
    fireEvent.click(screen.getByRole('button', { name: 'Nộp bài' }));
    await waitFor(() => expect(screen.getByText(/Cần đúng 4\/6 để hoàn thành/)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Làm lại' }));
    expect(screen.queryByText(/Cần đúng 4\/6/)).toBeNull();
    expect((screen.getByRole('button', { name: 'Nộp bài' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    const first = screen
      .getAllByRole('radio')
      .slice(0, 3)
      .map((r) => r.closest('label')!.textContent);
    expect(new Set(first).size).toBe(3);
  });

  it('tells the person that submitting adds phrases to the Phrase Bank', () => {
    setup();
    expect(screen.getByText(/được thêm vào Kho cụm từ để ôn/)).toBeTruthy();
  });

  it('keeps the answers when the submit fails, and says why', async () => {
    setup({ onSubmitQuiz: vi.fn().mockRejectedValue(new Error('Chưa nộp được bài kiểm tra.')) });
    pickAll();
    fireEvent.click(screen.getByRole('button', { name: 'Nộp bài' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Chưa nộp được'));
    expect((screen.getByRole('button', { name: 'Nộp bài' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});

describe('report', () => {
  it('sends the reason and thanks the person', async () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Báo bài sai' }));
    fireEvent.change(screen.getByLabelText('Lý do báo bài sai'), { target: { value: 'level' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi báo cáo' }));
    await waitFor(() => expect(screen.getByText(/Cảm ơn bạn đã báo/)).toBeTruthy());
    expect(props.onReport).toHaveBeenCalledWith('level');
  });
});
