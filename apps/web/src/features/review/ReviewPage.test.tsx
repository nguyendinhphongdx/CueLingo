import type { ReviewCard } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReviewEmptyState, ReviewSession, ReviewSummary } from './ReviewPage';

const card: ReviewCard = {
  itemId: '11111111-1111-4111-8111-111111111111',
  exercise: 'recognize',
  phrase: 'circle back',
  prompt: 'circle back',
  choices: ['quay lại vấn đề', 'kết thúc sớm'],
  answer: 'quay lại vấn đề',
  meaningVi: 'quay lại vấn đề',
  contextEn: "Let's circle back after lunch.",
};

describe('ReviewSession', () => {
  it('reveals the meaning, context, and four ratings after a correct answer', () => {
    const markup = renderToStaticMarkup(
      <ReviewSession
        card={card}
        position={3}
        total={10}
        selectedChoice="quay lại vấn đề"
        submitting={false}
        onChoose={() => {}}
        onRate={() => {}}
      />,
    );

    expect(markup).toContain('Chính xác');
    expect(markup).toContain('Nghĩa:');
    expect(markup).toContain('Let&#x27;s circle back after lunch.');
    for (const label of ['Lại', 'Khó', 'Được', 'Dễ']) expect(markup).toContain(label);
  });

  it('calls the rating action once for one click', () => {
    const onRate = vi.fn();
    const element = ReviewSession({
      card,
      position: 1,
      total: 1,
      selectedChoice: 'quay lại vấn đề',
      submitting: false,
      onChoose: () => {},
      onRate,
    });
    const ratingSection = element.props.children[1].props.children[3];
    const ratingButtons = ratingSection.props.children[1].props.children;
    ratingButtons[2].props.onClick();
    expect(onRate).toHaveBeenCalledOnce();
    expect(onRate).toHaveBeenCalledWith(3);
  });

  it('shows correct and incorrect totals at the end', () => {
    const markup = renderToStaticMarkup(
      <ReviewSummary result={{ correct: 7, incorrect: 3, dueRemaining: 2 }} onRestart={() => {}} />,
    );
    expect(markup).toContain('Hoàn thành phiên ôn');
    expect(markup).toContain('>7<');
    expect(markup).toContain('>3<');
    expect(markup).toContain('Ôn tiếp');
  });

  it('shows a cheerful empty state with a meetings link', () => {
    const markup = renderToStaticMarkup(<ReviewEmptyState />);
    expect(markup).toContain('Hôm nay bạn đã ôn xong');
    expect(markup).toContain('href="/sessions"');
  });

  it('shows a listen-and-type card without revealing the phrase before an answer', () => {
    const markup = renderToStaticMarkup(
      <ReviewSession
        card={{
          itemId: '00000000-0000-4000-8000-000000000009',
          exercise: 'dictation' as const,
          phrase: 'circle back',
          prompt: 'circle back',
          choices: [],
          answer: 'circle back',
          meaningVi: 'quay lại thảo luận sau',
          contextEn: null,
        }}
        position={1}
        total={3}
        selectedChoice={null}
        submitting={false}
        onChoose={() => {}}
        onRate={() => {}}
        loadAudio={async () => new Blob()}
      />,
    );
    expect(markup).toContain('Nghe và gõ lại');
    expect(markup).toContain('Bạn nghe được cụm từ nào?');
    expect(markup).toContain('aria-label="Gõ cụm từ bạn nghe được"');
    expect(markup).not.toContain('circle back');
  });
});
