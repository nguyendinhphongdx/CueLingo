import { describe, expect, it } from 'vitest';
import {
  enabledLanguages,
  guessLanguageFromEvent,
  LanguageQuerySchema,
  LearnableLanguageSchema,
  learnableLanguages,
  SUPPORTED_LANGUAGES,
} from './languages';

const withJapanese = [SUPPORTED_LANGUAGES.en, SUPPORTED_LANGUAGES.ja];

describe('guessLanguageFromEvent', () => {
  it('suggests nothing while a language is not switched on', () => {
    expect(SUPPORTED_LANGUAGES.ja.enabled).toBe(false);
    expect(guessLanguageFromEvent({ title: '日本チームと定例' })).toBeNull();
  });

  it('suggests Vietnamese from the title or a .vn attendee', () => {
    expect(guessLanguageFromEvent({ title: 'Họp tiếng Việt với đối tác' })).toBe('vi');
    expect(guessLanguageFromEvent({ title: 'Kickoff', attendeeDomains: ['acme.com.vn'] })).toBe(
      'vi',
    );
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

describe('Vietnamese registry entry', () => {
  it('is recognised in the cloud, not translated and not learnable', () => {
    const { vi } = SUPPORTED_LANGUAGES;
    expect(vi).toMatchObject({
      code: 'vi',
      name: 'Tiếng Việt',
      promptName: 'Vietnamese',
      recognizer: 'gemini-audio',
      wordBreaks: 'spaces',
      hasReading: false,
      recognition: 'cloud',
      translates: false,
      learnable: false,
      enabled: true,
    });
  });

  it('keeps English and Japanese on the device and learnable', () => {
    for (const language of [SUPPORTED_LANGUAGES.en, SUPPORTED_LANGUAGES.ja]) {
      expect(language.recognition).toBe('device');
      expect(language.translates).toBe(true);
      expect(language.learnable).toBe(true);
    }
  });

  it('lets a meeting use Vietnamese but never offers it to study', () => {
    expect(enabledLanguages().map((language) => language.code)).toEqual(['en', 'vi']);
    expect(learnableLanguages().map((language) => language.code)).toEqual(['en']);
    expect(LearnableLanguageSchema.safeParse('vi').success).toBe(false);
    expect(LearnableLanguageSchema.safeParse('en').success).toBe(true);
    expect(LanguageQuerySchema.safeParse({ language: 'vi' }).success).toBe(false);
  });
});
