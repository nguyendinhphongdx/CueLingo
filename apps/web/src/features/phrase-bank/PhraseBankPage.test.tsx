import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PhraseList } from './PhraseBankPage';

describe('PhraseList', () => {
  it('shows phrases and an accessible delete action', () => {
    const markup = renderToStaticMarkup(
      <PhraseList
        phrases={[{ id: '1', phrase: 'follow up', meaningVi: 'theo dõi tiếp', inReview: true }]}
        removingId={null}
        onRemove={() => {}}
      />,
    );
    expect(markup).toContain('follow up');
    expect(markup).toContain('theo dõi tiếp');
    expect(markup).toContain('aria-label="Xoá follow up"');
  });

  it('shows an empty state', () => {
    expect(
      renderToStaticMarkup(<PhraseList phrases={[]} removingId={null} onRemove={() => {}} />),
    ).toContain('Chưa có cụm từ nào');
  });
});
