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

describe('CaptionBlock word lookup', () => {
  const lookupButtons = (language: string) =>
    renderToStaticMarkup(
      <CaptionBlock
        segment={{ ...segment(language), text: 'Hello team' }}
        level={3}
        faded={false}
        showSpeaker={false}
        onLookup={() => {}}
      />,
    );

  it('offers lookup on English and none on Vietnamese captions', () => {
    expect(lookupButtons('en')).toContain('Tra từ Hello');
    expect(lookupButtons('vi')).not.toContain('Tra từ');
  });
});

describe('CaptionBlock speaker tag', () => {
  const tag = (event: Partial<ReturnType<typeof segment>> & { speaker?: string }) =>
    renderToStaticMarkup(
      <CaptionBlock
        segment={{ ...segment('vi'), ...event }}
        level={3}
        faded={false}
        showSpeaker
        onLookup={() => {}}
      />,
    );

  it('names the user, a labelled speaker and an unlabelled other person', () => {
    expect(tag({ stream: 'mic' })).toContain('Tôi');
    expect(tag({ speaker: 'speaker_2' })).toContain('Speaker 2');
    expect(tag({})).toContain('Người khác');
  });

  it('shows no tag when showSpeaker is off', () => {
    expect(render('vi')).not.toContain('data-slot="speaker-tag"');
  });
});

describe('CaptionBlock offline label (ADR 0024)', () => {
  const html = (overrides: { offline?: boolean; partial?: boolean }) =>
    renderToStaticMarkup(
      <CaptionBlock
        segment={{ ...segment('vi'), ...overrides }}
        level={3}
        faded={false}
        showSpeaker={false}
        onLookup={() => {}}
      />,
    );

  it('marks a sentence recognised on this machine', () => {
    expect(html({ offline: true })).toContain('Ngoại tuyến');
  });

  it('marks nothing for a cloud sentence, or while the sentence is still partial', () => {
    expect(html({})).not.toContain('Ngoại tuyến');
    expect(html({ offline: true, partial: true })).not.toContain('Ngoại tuyến');
  });
});

describe('CaptionBlock and the assistant', () => {
  it('offers "Giải thích" on a finished sentence only when the assistant is there (AC6)', () => {
    const block = (partial: boolean, onExplain?: () => void) =>
      renderToStaticMarkup(
        <CaptionBlock
          segment={{ ...segment('en'), partial }}
          level={3}
          faded={false}
          showSpeaker={false}
          onLookup={() => {}}
          onExplain={onExplain}
        />,
      );
    expect(block(false, () => {})).toContain('Giải thích');
    expect(block(false)).not.toContain('Giải thích');
    expect(block(true, () => {})).not.toContain('Giải thích');
  });
});
