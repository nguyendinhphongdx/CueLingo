import { describe, expect, it } from 'vitest';
import { guessLanguageFromEvent, SUPPORTED_LANGUAGES } from './languages';

const withJapanese = [SUPPORTED_LANGUAGES.en, SUPPORTED_LANGUAGES.ja];

describe('guessLanguageFromEvent', () => {
  it('suggests nothing while a language is not switched on', () => {
    expect(SUPPORTED_LANGUAGES.ja.enabled).toBe(false);
    expect(guessLanguageFromEvent({ title: '日本チームと定例' })).toBeNull();
  });

  it('finds Japanese by a word in the title or location', () => {
    expect(guessLanguageFromEvent({ title: '日本チームと定例' }, withJapanese)).toBe('ja');
    expect(guessLanguageFromEvent({ title: 'Sync', location: 'Tokyo office' }, withJapanese)).toBe(
      'ja',
    );
  });

  it('finds Japanese by an attendee domain', () => {
    expect(
      guessLanguageFromEvent({ title: 'Kickoff', attendeeDomains: ['acme.co.jp'] }, withJapanese),
    ).toBe('ja');
  });

  it('says nothing for an ordinary English meeting', () => {
    expect(
      guessLanguageFromEvent(
        { title: 'Weekly sync with London', attendeeDomains: ['example.com'] },
        withJapanese,
      ),
    ).toBeNull();
  });

  it('never suggests English from a calendar', () => {
    expect(guessLanguageFromEvent({ title: 'London sync' }, [SUPPORTED_LANGUAGES.en])).toBeNull();
  });
});
