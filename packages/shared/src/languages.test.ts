import { describe, expect, it } from 'vitest';
import {
  enabledLanguages,
  guessLanguageFromEvent,
  languageOptions,
  learnableLanguageOptions,
  LanguageQuerySchema,
  LearnableLanguageSchema,
  learnableLanguages,
  SUPPORTED_LANGUAGES,
} from './languages';

const withJapanese = [SUPPORTED_LANGUAGES.en, SUPPORTED_LANGUAGES.ja];

describe('guessLanguageFromEvent', () => {
  it('suggests Japanese, Korean and Chinese now that they are switched on', () => {
    expect(guessLanguageFromEvent({ title: '日本チームと定例' })).toBe('ja');
    expect(guessLanguageFromEvent({ title: '한국 팀과 주간 회의' })).toBe('ko');
    expect(guessLanguageFromEvent({ title: 'Sync', location: 'Seoul office' })).toBe('ko');
    expect(guessLanguageFromEvent({ title: 'Kickoff', attendeeDomains: ['acme.co.kr'] })).toBe(
      'ko',
    );
    expect(guessLanguageFromEvent({ title: '中文评审会' })).toBe('zh');
    expect(guessLanguageFromEvent({ title: 'Sync', location: 'Shanghai' })).toBe('zh');
    expect(guessLanguageFromEvent({ title: 'Kickoff', attendeeDomains: ['acme.com.cn'] })).toBe(
      'zh',
    );
  });

  it.each([
    'Họp hàng tuần',
    'Gặp khách hàng',
    'Cập nhật tiến độ',
    'Tập trung sprint',
    'Họp với anh Trung',
    'Họp ngân hàng',
    'Trung tâm dữ liệu',
  ])('does not mistake the Vietnamese title %s for another language', (title) => {
    expect(guessLanguageFromEvent({ title })).toBeNull();
  });

  it('matches the full Vietnamese phrases and whole Latin words', () => {
    expect(guessLanguageFromEvent({ title: 'Họp tiếng Hàn với đối tác' })).toBe('ko');
    expect(guessLanguageFromEvent({ title: 'Học tiếng Trung' })).toBe('zh');
    expect(guessLanguageFromEvent({ title: 'Họp tiếng Nhật' })).toBe('ja');
    expect(guessLanguageFromEvent({ title: 'Sync with Korea team' })).toBe('ko');
    expect(guessLanguageFromEvent({ title: 'Machinal review' })).toBeNull();
    expect(guessLanguageFromEvent({ title: 'Chinatown lunch' })).toBeNull();
  });

  it('says nothing when two languages match', () => {
    expect(guessLanguageFromEvent({ title: 'Korea and China sync' })).toBeNull();
    expect(guessLanguageFromEvent({ title: 'Sync', attendeeDomains: ['a.kr', 'b.cn'] })).toBeNull();
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

  it('recognises Japanese, Korean and Chinese in the cloud', () => {
    const { ja, ko, zh } = SUPPORTED_LANGUAGES;
    expect(ja).toMatchObject({
      recognizer: 'gemini-audio',
      recognition: 'cloud',
      translates: true,
      learnable: true,
      hasReading: true,
      wordBreaks: 'dictionary',
      enabled: true,
    });
    expect(ko).toMatchObject({
      name: 'Tiếng Hàn',
      nativeName: '한국어',
      promptName: 'Korean',
      recognizer: 'gemini-audio',
      wordBreaks: 'spaces',
      hasReading: false,
      recognition: 'cloud',
      translates: true,
      learnable: false,
      enabled: true,
    });
    expect(zh).toMatchObject({
      name: 'Tiếng Trung',
      nativeName: '中文',
      promptName: 'Chinese',
      recognizer: 'gemini-audio',
      wordBreaks: 'dictionary',
      hasReading: false,
      recognition: 'cloud',
      translates: true,
      learnable: false,
      enabled: true,
    });
  });

  it('keeps English on the device and learnable', () => {
    const { en } = SUPPORTED_LANGUAGES;
    expect(en.recognition).toBe('device');
    expect(en.translates).toBe(true);
    expect(en.learnable).toBe(true);
  });

  it('has a transcription hint for every language but English', () => {
    expect(SUPPORTED_LANGUAGES.en.sttHint).toBe('');
    expect(SUPPORTED_LANGUAGES.vi.sttHint).toContain('diacritic');
    expect(SUPPORTED_LANGUAGES.ja.sttHint).toContain('kanji');
    expect(SUPPORTED_LANGUAGES.ko.sttHint).toContain('Hangul');
    expect(SUPPORTED_LANGUAGES.zh.sttHint).toContain('Simplified Chinese');
  });

  it('lets a meeting use the new languages and offers only English and Japanese to study', () => {
    expect(enabledLanguages().map((language) => language.code)).toEqual([
      'en',
      'ja',
      'ko',
      'zh',
      'vi',
    ]);
    expect(learnableLanguages().map((language) => language.code)).toEqual(['en', 'ja']);
    expect(LearnableLanguageSchema.safeParse('vi').success).toBe(false);
    expect(LearnableLanguageSchema.safeParse('ko').success).toBe(false);
    expect(LearnableLanguageSchema.safeParse('ja').success).toBe(true);
    expect(LearnableLanguageSchema.safeParse('en').success).toBe(true);
    expect(LanguageQuerySchema.safeParse({ language: 'vi' }).success).toBe(false);
    expect(LanguageQuerySchema.safeParse({ language: 'zh' }).success).toBe(false);
  });

  it('labels options with the native name when it differs', () => {
    expect(languageOptions().map((option) => option.label)).toEqual([
      'Tiếng Anh · English',
      'Tiếng Nhật · 日本語',
      'Tiếng Hàn · 한국어',
      'Tiếng Trung · 中文',
      'Tiếng Việt',
    ]);
    expect(learnableLanguageOptions().map((option) => option.label)).toEqual([
      'Tiếng Anh · English',
      'Tiếng Nhật · 日本語',
    ]);
  });
});

describe('labelsSpeakers', () => {
  it('is off for every language until a better way to tell speakers apart passes its check', () => {
    for (const language of Object.values(SUPPORTED_LANGUAGES)) {
      expect(language.labelsSpeakers).toBe(false);
    }
  });

  it('is only ever on where recognition is in the cloud', () => {
    for (const language of Object.values(SUPPORTED_LANGUAGES)) {
      if (language.labelsSpeakers) expect(language.recognition).toBe('cloud');
    }
  });
});
