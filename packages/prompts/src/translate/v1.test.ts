import { describe, expect, it } from 'vitest';
import { translateFixtures } from './fixtures/cases';
import { buildTranslatePrompt, TranslateInputSchema } from './v1';

describe('translate.realtime v1', () => {
  it('puts glossary, context and the sentence in order', () => {
    const { prompt } = buildTranslatePrompt({
      text: 'Ship it.',
      previous: ['Are we ready?'],
      glossary: [{ term: 'ship', translation: 'phát hành' }],
    });
    expect(prompt.indexOf('Glossary')).toBeLessThan(prompt.indexOf('Earlier sentences'));
    expect(prompt.indexOf('Earlier sentences')).toBeLessThan(prompt.indexOf('Last sentence'));
    expect(prompt).toContain('ship => phát hành');
  });

  it('omits empty sections', () => {
    expect(buildTranslatePrompt({ text: 'Hi.' }).prompt).toBe('Last sentence:\nHi.');
  });

  it('names the meeting language in the system prompt, English by default', () => {
    expect(buildTranslatePrompt({ text: 'Hi.' }).system).toContain('an English business meeting');
    expect(buildTranslatePrompt({ text: 'こんにちは。', language: 'ja' }).system).toContain(
      'a Japanese business meeting',
    );
  });

  it('rejects empty text and more than three context sentences', () => {
    expect(TranslateInputSchema.safeParse({ text: '  ' }).success).toBe(false);
    expect(
      TranslateInputSchema.safeParse({ text: 'x', previous: ['a', 'b', 'c', 'd'] }).success,
    ).toBe(false);
  });

  it('ships fixtures that all parse', () => {
    for (const f of translateFixtures)
      expect(TranslateInputSchema.safeParse(f.input).success).toBe(true);
  });
});
