import type { ReviewCard } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReviewCardView, ReviewEmptyState, ReviewSummary } from './ReviewPage';
import { submitReviewAnswer } from './use-review';

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

describe('desktop review', () => {
  it('reveals the answer details and four ratings after a local choice', () => {
    const markup = renderToStaticMarkup(
      <ReviewCardView
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
    expect(markup).toContain('Thẻ 3 trên 10');
    for (const label of ['Lại', 'Khó', 'Được', 'Dễ']) expect(markup).toContain(label);
  });

  it('renders a cloze prompt with numbered choices', () => {
    const markup = renderToStaticMarkup(
      <ReviewCardView
        card={{ ...card, exercise: 'cloze', prompt: "Let's ____ after lunch." }}
        position={1}
        total={1}
        selectedChoice={null}
        submitting={false}
        onChoose={() => {}}
        onRate={() => {}}
      />,
    );

    expect(markup).toContain('Điền cụm từ còn thiếu');
    expect(markup).toContain('Let&#x27;s ____ after lunch.');
    expect(markup).toContain('aria-label="1. quay lại vấn đề"');
  });

  it('posts one answer and advances once when submission is triggered twice', async () => {
    let resolveRequest!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });
    const answerReview = vi.fn(async () => {
      await pending;
      return { nextDue: '2026-11-07T00:00:00.000Z' };
    });
    const advance = vi.fn();
    const submitting = { current: false };
    const input = {
      api: { answerReview },
      card,
      rating: 3 as const,
      responseMs: 820,
      submitting,
      advance,
    };

    const first = submitReviewAnswer(input);
    const second = submitReviewAnswer(input);
    expect(await second).toBe(false);
    resolveRequest();
    expect(await first).toBe(true);

    expect(answerReview).toHaveBeenCalledOnce();
    expect(advance).toHaveBeenCalledOnce();
    expect(answerReview).toHaveBeenCalledWith({
      itemId: card.itemId,
      exercise: card.exercise,
      rating: 3,
      responseMs: 820,
    });
  });

  it('shows summary and encouraging empty states', () => {
    const summary = renderToStaticMarkup(
      <ReviewSummary result={{ correct: 7, incorrect: 3, dueRemaining: 2 }} onRestart={() => {}} />,
    );
    const empty = renderToStaticMarkup(<ReviewEmptyState />);

    expect(summary).toContain('Hoàn thành phiên ôn');
    expect(summary).toContain('Ôn tiếp');
    expect(empty).toContain('Hôm nay bạn đã ôn xong');
    expect(empty).toContain('tiếp tục dùng CueLingo trong cuộc họp');
  });

  it('shows a listen-and-type card without revealing the phrase before an answer', () => {
    const markup = renderToStaticMarkup(
      <ReviewCardView
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
