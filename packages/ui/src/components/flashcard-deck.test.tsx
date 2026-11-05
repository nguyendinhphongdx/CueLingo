import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FlashcardDeck, FlashcardFace, type ReviewCardLike } from './flashcard-deck';

const card: ReviewCardLike = {
  itemId: 'a',
  exercise: 'recognize',
  phrase: 'follow up',
  prompt: 'follow up',
  answer: 'theo dõi tiếp',
  meaningVi: 'theo dõi tiếp',
  contextEn: "Let's follow up next week.",
};

describe('FlashcardFace', () => {
  it('shows the English phrase in front and the meaning with the meeting sentence behind', () => {
    const markup = renderToStaticMarkup(<FlashcardFace card={card} flipped={false} />);
    expect(markup).toContain('follow up');
    expect(markup).toContain('Chạm để lật');
    expect(markup).toContain('theo dõi tiếp');
    expect(markup).toContain('Let&#x27;s follow up next week.');
    expect(markup).toContain('rotateY(0deg)');
    expect(renderToStaticMarkup(<FlashcardFace card={card} flipped />)).toContain(
      'rotateY(180deg)',
    );
  });

  it('hides the phrase of a listening card until it is turned', () => {
    const markup = renderToStaticMarkup(
      <FlashcardFace
        card={{ ...card, exercise: 'dictation', prompt: 'follow up' }}
        flipped={false}
        loadAudio={async () => new Blob()}
      />,
    );
    const front = markup.slice(0, markup.indexOf('data-face="back"'));
    expect(front).toContain('Bạn nghe được cụm từ nào?');
    expect(front).not.toContain('>follow up<');
  });

  it('marks the face that is out of sight for assistive technology', () => {
    const markup = renderToStaticMarkup(<FlashcardFace card={card} flipped={false} />);
    expect(markup).toContain('aria-hidden="true" data-face="back"');
  });
});

describe('FlashcardDeck', () => {
  const render = () =>
    renderToStaticMarkup(
      <FlashcardDeck card={card} position={2} total={5} submitting={false} onRate={vi.fn()} />,
    );

  it('shows progress and the instruction for a card not yet turned', () => {
    const markup = render();
    expect(markup).toContain('2/5');
    expect(markup).toContain('Nghĩ câu trả lời trước');
    expect(markup).toContain('role="progressbar"');
  });

  it('keeps all four rating buttons disabled until the card is turned', () => {
    const buttons = render().match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(4);
    expect(buttons.every((tag) => tag.includes('disabled=""'))).toBe(true);
  });

  it('names every direction for people who do not see the gesture', () => {
    expect(render()).toContain('vuốt phải Được, trái Lại, lên Dễ, xuống Khó');
  });
});
