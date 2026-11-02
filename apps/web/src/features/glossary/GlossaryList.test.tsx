import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GlossaryList } from './GlossaryList';

const term = (id: string, text: string, translation: string | null = null) => ({
  id,
  term: text,
  translation,
  note: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  language: 'en' as const,
});

describe('GlossaryList', () => {
  it('shows an empty state when there are no terms', () => {
    const markup = renderToStaticMarkup(<GlossaryList items={[]} onRemove={() => {}} />);
    expect(markup).toContain('Chưa có thuật ngữ nào');
  });

  it('lists each term with its translation and an accessible remove button', () => {
    const markup = renderToStaticMarkup(
      <GlossaryList
        items={[term('1', 'Sprint review', 'buổi review sprint'), term('2', 'Acme')]}
        onRemove={() => {}}
      />,
    );
    expect(markup).toContain('Sprint review');
    expect(markup).toContain('buổi review sprint');
    expect(markup).toContain('aria-label="Xoá Acme"');
  });
});
