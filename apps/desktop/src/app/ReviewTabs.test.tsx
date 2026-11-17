import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../study', () => ({
  ReviewPage: () => <p>panel-today</p>,
  PhrasesPage: () => <p>panel-phrases</p>,
}));
vi.mock('../insights', () => ({ ProgressPage: () => <p>panel-progress</p> }));

import { ReviewTabs, tabForView } from './ReviewTabs';

describe('Ôn tập tabs', () => {
  it('maps the old sidebar ids to a tab and leaves other views alone', () => {
    expect(tabForView('review')).toBe('today');
    expect(tabForView('phrases')).toBe('phrases');
    expect(tabForView('progress')).toBe('progress');
    expect(tabForView('home')).toBeNull();
  });

  it('draws the three tabs and only the open panel', () => {
    const markup = renderToStaticMarkup(<ReviewTabs tab="phrases" />);
    for (const label of ['Hôm nay', 'Kho cụm từ', 'Tiến độ']) expect(markup).toContain(label);
    expect(markup).toContain('<p>panel-phrases</p>');
    expect(markup).not.toContain('<p>panel-today</p>');
    expect(markup).toContain('id="review-panel-phrases"');
  });

  it('opens Hôm nay for an unknown tab', () => {
    expect(renderToStaticMarkup(<ReviewTabs tab="nope" />)).toContain('<p>panel-today</p>');
  });
});
