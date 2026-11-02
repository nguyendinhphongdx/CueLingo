import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DictationCard } from './dictation-card';
import { SpeakButton } from './speak-button';

const card = {
  itemId: '00000000-0000-4000-8000-000000000001',
  prompt: 'circle back',
  answer: 'circle back',
};

describe('DictationCard', () => {
  it('offers to listen, listen slowly, type, and give up', () => {
    const markup = renderToStaticMarkup(
      <DictationCard card={card} loadAudio={async () => new Blob()} onAnswer={() => undefined} />,
    );
    expect(markup).toContain('>Nghe<');
    expect(markup).toContain('Nghe chậm');
    expect(markup).toContain('aria-label="Gõ cụm từ bạn nghe được"');
    expect(markup).toContain('Không nghe ra');
    expect(markup).toContain('>Kiểm tra<');
  });

  it('does not show the answer before the person has tried', () => {
    const markup = renderToStaticMarkup(
      <DictationCard card={card} loadAudio={async () => new Blob()} onAnswer={() => undefined} />,
    );
    expect(markup).not.toContain('circle back');
  });
});

describe('SpeakButton', () => {
  it('is a labelled icon button', () => {
    const markup = renderToStaticMarkup(
      <SpeakButton text="push back" loadAudio={async () => new Blob()} />,
    );
    expect(markup).toContain('aria-label="Nghe phát âm"');
    expect(markup).toContain('title="Nghe phát âm"');
  });
});
