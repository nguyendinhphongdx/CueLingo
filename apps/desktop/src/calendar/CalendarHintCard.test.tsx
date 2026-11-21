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

describe('CalendarHintCard preparation (AC2)', () => {
  const prep = { onPrepare: noop, preparing: false, failed: false, result: null };

  it('offers Chuẩn bị only when earlier meetings match', () => {
    const without = renderToStaticMarkup(
      <CalendarHintView hint={hint} now={NOW} onStart={noop} onDismiss={noop} />,
    );
    expect(without).not.toContain('Chuẩn bị');
    const withPrep = renderToStaticMarkup(
      <CalendarHintView hint={hint} now={NOW} onStart={noop} onDismiss={noop} prep={prep} />,
    );
    expect(withPrep).toContain('Chuẩn bị');
  });

  it('lists saved phrases and glossary terms once prepared, and says so when a call fails', () => {
    const lesson = {
      phrase: 'touch base',
      itemId: '3f2b9a52-6a4e-4d1e-9a52-1f7a7a3b9c10',
      meaningVi: 'giữ liên lạc',
      status: 'todo' as const,
      origin: 'phrase' as const,
    };
    const ready = renderToStaticMarkup(
      <CalendarHintView
        hint={hint}
        now={NOW}
        onStart={noop}
        onDismiss={noop}
        prep={{
          ...prep,
          result: { lessons: [lesson], terms: [{ term: 'SLA', translation: null }] },
        }}
      />,
    );
    expect(ready).toContain('touch base');
    expect(ready).toContain('giữ liên lạc');
    expect(ready).toContain('Thuật ngữ: SLA');
    const failed = renderToStaticMarkup(
      <CalendarHintView
        hint={hint}
        now={NOW}
        onStart={noop}
        onDismiss={noop}
        prep={{ ...prep, failed: true }}
      />,
    );
    expect(failed).toContain('Không tải được phần chuẩn bị');
  });
});
