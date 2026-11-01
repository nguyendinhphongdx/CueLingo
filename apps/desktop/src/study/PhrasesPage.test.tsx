import type { Phrase } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { filterPhrases, PhraseList } from './PhrasesPage';
import { confirmPhraseRemoval } from './use-phrases';

const phrase: Phrase = {
  id: '11111111-1111-4111-8111-111111111111',
  phrase: 'follow up',
  meaningVi: 'theo dõi tiếp',
  inReview: true,
};

describe('desktop phrase bank', () => {
  it('shows the phrase, meaning, review status, and delete action', () => {
    const markup = renderToStaticMarkup(
      <PhraseList phrases={[phrase]} removingId={null} failedId={null} onRemove={() => {}} />,
    );

    expect(markup).toContain('follow up');
    expect(markup).toContain('theo dõi tiếp');
    expect(markup).toContain('Đang ôn');
    expect(markup).toContain('aria-label="Xoá follow up"');
  });

  it('shows Vietnamese empty and retry states', () => {
    const empty = renderToStaticMarkup(
      <PhraseList phrases={[]} removingId={null} failedId={null} onRemove={() => {}} />,
    );
    const failed = renderToStaticMarkup(
      <PhraseList phrases={[phrase]} removingId={null} failedId={phrase.id} onRemove={() => {}} />,
    );

    expect(empty).toContain('Chưa có cụm từ nào');
    expect(failed).toContain('Không thể xoá cụm từ');
    expect(failed).toContain('Thử lại');
  });

  it('asks for confirmation with the phrase name', () => {
    const confirm = vi.fn(() => true);

    expect(confirmPhraseRemoval('follow up', confirm)).toBe(true);
    expect(confirm).toHaveBeenCalledWith('Xoá “follow up” khỏi danh sách cụm từ?');
  });

  it('filters by the English phrase or Vietnamese meaning', () => {
    const phrases = [
      phrase,
      {
        ...phrase,
        id: '22222222-2222-4222-8222-222222222222',
        phrase: 'wrap up',
        meaningVi: 'kết thúc',
      },
    ];

    expect(filterPhrases(phrases, 'FOLLOW')).toEqual([phrase]);
    expect(filterPhrases(phrases, 'kết thúc')).toEqual([phrases[1]]);
    expect(filterPhrases(phrases, 'không có')).toEqual([]);
  });
});
