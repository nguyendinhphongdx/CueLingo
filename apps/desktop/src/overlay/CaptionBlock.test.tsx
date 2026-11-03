import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CaptionBlock } from './CaptionBlock';

const segment = (language: string, mic = false) => ({
  segmentId: '3344ed67-4d83-4778-bcd2-41af6165755f',
  stream: mic ? ('mic' as const) : ('system' as const),
  text: 'Xin chào mọi người',
  translation: null,
  partial: false,
  language,
});
const render = (language: string, level = 3) =>
  renderToStaticMarkup(
    <CaptionBlock
      segment={segment(language)}
      level={level}
      faded={false}
      showSpeaker={false}
      onLookup={() => {}}
    />,
  );

describe('CaptionBlock without a translation', () => {
  it('waits for a translation in a translated language', () => {
    expect(render('en')).toContain('Đang dịch…');
  });

  it('shows no translation line and no spinner for Vietnamese, even at Assist level 1', () => {
    for (const level of [1, 3, 5]) {
      const markup = render('vi', level);
      expect(markup).not.toContain('Đang dịch');
      expect(markup).not.toContain('data-role="translation"');
      expect(markup).toContain('data-role="original"');
    }
  });
});
