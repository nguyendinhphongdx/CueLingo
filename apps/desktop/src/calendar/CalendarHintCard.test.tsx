import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CalendarHintView } from './CalendarHintCard';

const NOW = 1_000_000_000_000;
const hint = { key: 'k', title: 'Weekly sync', startMs: NOW + 10 * 60_000, switchTo: null };
const noop = () => {};

describe('CalendarHintCard', () => {
  it('shows the meeting with Start for it and Skip', () => {
    const markup = renderToStaticMarkup(
      <CalendarHintView hint={hint} now={NOW} onStart={noop} onDismiss={noop} />,
    );
    expect(markup).toContain('Weekly sync');
    expect(markup).toContain('Còn 10 phút');
    expect(markup).toContain('Bắt đầu cho cuộc họp này');
    expect(markup).toContain('Bỏ qua');
  });

  it('tells the person when starting switches the language', () => {
    const markup = renderToStaticMarkup(
      <CalendarHintView
        hint={{ ...hint, switchTo: 'ja' }}
        now={NOW}
        onStart={noop}
        onDismiss={noop}
      />,
    );
    expect(markup).toContain('CueLingo sẽ nghe');
  });
});
