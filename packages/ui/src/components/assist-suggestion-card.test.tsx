import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AssistSuggestionCard } from './assist-suggestion-card';

const base = { currentLevel: 4, suggestedLevel: 3, meetingsConsidered: 3, avgComprehensionPct: 88 };

describe('AssistSuggestionCard', () => {
  it('offers to lower the help with the numbers behind it and an equal way out', () => {
    const markup = renderToStaticMarkup(
      <AssistSuggestionCard
        suggestion={{ kind: 'lower', ...base }}
        onApply={() => undefined}
        onLater={() => undefined}
      />,
    );
    expect(markup).toContain('Bạn nghe tốt hơn rồi');
    expect(markup).toContain('3 cuộc họp gần nhất bạn hiểu trung bình 88%');
    expect(markup).toContain('Chuyển sang “Gợi ý”');
    expect(markup).toContain('Để sau');
    expect(markup).toContain('7 ngày');
  });

  it('offers more help after hard meetings', () => {
    const markup = renderToStaticMarkup(
      <AssistSuggestionCard
        suggestion={{
          kind: 'raise',
          ...base,
          currentLevel: 1,
          suggestedLevel: 3,
          avgComprehensionPct: 42,
        }}
        onApply={() => undefined}
        onLater={() => undefined}
      />,
    );
    expect(markup).toContain('Cuộc họp gần đây còn khó');
    expect(markup).toContain('khoảng 42%');
  });

  it('disables both buttons while an answer is being saved', () => {
    const markup = renderToStaticMarkup(
      <AssistSuggestionCard
        busy
        suggestion={{ kind: 'lower', ...base }}
        onApply={() => undefined}
        onLater={() => undefined}
      />,
    );
    expect(markup.match(/disabled=""/g)).toHaveLength(2);
  });
});
