import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Tabs } from './tabs';

describe('Tabs', () => {
  it('marks the selected tab and gives the others tabindex -1', () => {
    const html = renderToStaticMarkup(
      <Tabs
        aria-label="Ôn tập"
        idPrefix="r"
        value="b"
        onChange={() => {}}
        tabs={[
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]}
      />,
    );
    expect(html).toContain('role="tablist"');
    expect(html).toMatch(
      /id="r-tab-b"[^>]*aria-selected="true"[^>]*aria-controls="r-panel-b"[^>]*tabindex="0"/,
    );
    expect(html).toMatch(/id="r-tab-a"[^>]*aria-selected="false"[^>]*tabindex="-1"/);
  });
});
