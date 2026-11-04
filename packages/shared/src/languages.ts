import { z } from 'zod';

/**
 * Languages the product knows about. One entry says everything a language needs; nothing else in the
 * code should branch on a language code. Adding a language is one entry here, an evaluation set for
 * recognition and translation, and a look at the prompts (ADR 0013).
 */
export const SUPPORTED_LANGUAGES = {
  en: {
    code: 'en',
    /** Name in Vietnamese, for the interface. */
    name: 'Tiếng Anh',
    nativeName: 'English',
    /** The name used inside prompts, which are written in English. */
    promptName: 'English',
    /** What in a calendar event points to this language; English is the default so it has none. */
    calendarHints: { keywords: [] as string[], domains: [] as string[] },
    /** On-device recognition model the sidecar loads for this language. */
    recognizer: 'parakeet-tdt-v2-en',
    /** How words are told apart, for tap-to-look-up and typed answers. */
    wordBreaks: 'spaces',
    /** Whether a reading (such as furigana) accompanies words. */
    hasReading: false,
    /** Where speech is recognised: on the device (sidecar model) or in the cloud (audio leaves the machine, ADR 0014). */
    recognition: 'device' as 'device' | 'cloud',
    /** Whether the meeting is translated to Vietnamese. */
    translates: true as boolean,
    /** Whether the language feeds the learner model, review, phrases and progress. */
    learnable: true as boolean,
    /**
     * Whether people other than the user are told apart in the system stream (cloud recognition only).
     * Off everywhere: the speaker-labels check (2026-11-04) found Gemini cannot match a voice against
     * text descriptions of earlier speakers (33-67% wrong labels), so no wrong labels are shown.
     */
    labelsSpeakers: false as boolean,
    /** Switched on for people. A language stays off until it passes its evaluation. */
    enabled: true,
    /** English guidance for the cloud transcription prompt (stt.transcribe@v3); empty when none is needed. */
    sttHint: '',
  },
  ja: {
    code: 'ja',
    name: 'Tiếng Nhật',
    nativeName: '日本語',
    promptName: 'Japanese',
    calendarHints: {
      keywords: [
        '日本',
        '日本語',
        'japan',
        'japanese',
        'tokyo',
        'osaka',
        'tiếng nhật',
        '(jp)',
        '[jp]',
      ],
      domains: ['.jp'],
    },
    // Recognised in the cloud for now. The on-device Japanese model stays in the sidecar for a
    // later evaluation (ADR 0016).
    recognizer: 'gemini-audio',
    wordBreaks: 'dictionary',
    hasReading: true,
    recognition: 'cloud',
    translates: true,
    learnable: true,
    labelsSpeakers: false,
    enabled: true,
    sttHint:
      'Write Japanese in its normal script (kanji, hiragana, katakana) with natural punctuation; do not romanise; keep Latin-script product names and acronyms as spoken.',
  },
  ko: {
    code: 'ko',
    name: 'Tiếng Hàn',
    nativeName: '한국어',
    promptName: 'Korean',
    calendarHints: {
      keywords: ['한국', '한국어', 'korea', 'korean', 'seoul', 'tiếng hàn', '(kr)', '[kr]'],
      domains: ['.kr'],
    },
    recognizer: 'gemini-audio',
    wordBreaks: 'spaces',
    hasReading: false,
    recognition: 'cloud',
    translates: true,
    learnable: false,
    labelsSpeakers: false,
    enabled: true,
    sttHint:
      'Write Korean in Hangul with natural spacing and punctuation; do not romanise; keep Latin-script product names and acronyms as spoken.',
  },
  zh: {
    code: 'zh',
    name: 'Tiếng Trung',
    nativeName: '中文',
    promptName: 'Chinese',
    calendarHints: {
      keywords: [
        '中国',
        '中文',
        '汉语',
        'china',
        'chinese',
        'beijing',
        'shanghai',
        'tiếng trung',
        '(cn)',
        '[cn]',
      ],
      domains: ['.cn'],
    },
    recognizer: 'gemini-audio',
    wordBreaks: 'dictionary',
    hasReading: false,
    recognition: 'cloud',
    translates: true,
    learnable: false,
    labelsSpeakers: false,
    enabled: true,
    sttHint:
      'Write Mandarin Chinese in Simplified Chinese characters (简体中文) with Chinese punctuation, never Traditional characters and never pinyin; keep Latin-script product names and acronyms as spoken.',
  },
  vi: {
    code: 'vi',
    name: 'Tiếng Việt',
    nativeName: 'Tiếng Việt',
    promptName: 'Vietnamese',
    calendarHints: {
      keywords: ['tiếng việt', 'vietnamese', '(vn)', '[vn]'],
      domains: ['.vn'],
    },
    recognizer: 'gemini-audio',
    wordBreaks: 'spaces',
    hasReading: false,
    recognition: 'cloud',
    translates: false,
    learnable: false,
    labelsSpeakers: false,
    enabled: true,
    sttHint:
      'Vietnamese rules:\n- Keep every diacritic (dấu) exact: tone marks and vowel marks must match what is said. Do not drop or guess them.\n- Write numbers, dates, times and amounts as plain digits where that is natural (for example "15 tháng 3", "2 giờ chiều", "30%"); keep small counts in words when they read better.\n- Keep proper names and English technical or product terms as they are spoken; do not translate them into Vietnamese and do not respell them.',
  },
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;
export type LanguageInfo = (typeof SUPPORTED_LANGUAGES)[LanguageCode];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export const LanguageCodeSchema = z.enum(
  Object.keys(SUPPORTED_LANGUAGES) as [LanguageCode, ...LanguageCode[]],
);

export const isLanguageCode = (value: unknown): value is LanguageCode =>
  typeof value === 'string' && value in SUPPORTED_LANGUAGES;

/** Languages a meeting may use today. */
export const enabledLanguages = (): LanguageInfo[] =>
  Object.values(SUPPORTED_LANGUAGES).filter((language) => language.enabled);

/** A language a person may use today: known to the registry and switched on. */
export const EnabledLanguageSchema = LanguageCodeSchema.refine(
  (code) => SUPPORTED_LANGUAGES[code].enabled,
  { message: 'This language is not available yet' },
);

/** Languages a person may study today: switched on and feeding the learner model. */
export const learnableLanguages = (): LanguageInfo[] =>
  enabledLanguages().filter((language) => language.learnable);

/** A language to study: switched on and learnable. Meeting-only languages (Vietnamese) fail. */
export const LearnableLanguageSchema = EnabledLanguageSchema.refine(
  (code) => SUPPORTED_LANGUAGES[code].learnable,
  { message: 'This language cannot be studied' },
);

/** `?language=` on every read of per-language learning data. Missing means the default language. */
export const LanguageQuerySchema = z.object({
  language: LanguageCodeSchema.refine((code) => SUPPORTED_LANGUAGES[code].learnable, {
    message: 'This language cannot be studied',
  }).default(DEFAULT_LANGUAGE),
});
export type LanguageQuery = z.output<typeof LanguageQuerySchema>;

/** `Tiếng Nhật · 日本語`; just the name when the native name is the same. */
const labelOf = (language: LanguageInfo): string =>
  language.nativeName === language.name
    ? language.name
    : `${language.name} · ${language.nativeName}`;

/** The languages a meeting may use, as `{ value, label }` for the meeting language picker. */
export const languageOptions = (): Array<{ value: LanguageCode; label: string }> =>
  enabledLanguages().map((language) => ({ value: language.code, label: labelOf(language) }));

/** The languages a person may study, as `{ value, label }` for learner screens. */
export const learnableLanguageOptions = (): Array<{ value: LanguageCode; label: string }> =>
  learnableLanguages().map((language) => ({ value: language.code, label: labelOf(language) }));

/** What a calendar event tells about the meeting. Titles and domains stay on the device. */
export interface CalendarEventHint {
  title: string;
  location?: string;
  /** Domains of the attendees' email addresses, such as `example.co.jp`. */
  attendeeDomains?: string[];
}

/** Plain Latin words match whole words only ("china" is not inside "machinal"); other keywords match as text. */
function mentions(text: string, keyword: string): boolean {
  if (!/^[a-z]+$/.test(keyword)) return text.includes(keyword);
  return new RegExp(`(?<![a-z])${keyword}(?![a-z])`).test(text);
}

/**
 * The language a calendar event points to, or null when it says nothing or points two ways. Only
 * languages that are switched on count, and English (the default) is never suggested from a calendar.
 */
export function guessLanguageFromEvent(
  event: CalendarEventHint,
  candidates: readonly LanguageInfo[] = enabledLanguages(),
): LanguageCode | null {
  const text = `${event.title} ${event.location ?? ''}`.toLowerCase();
  const domains = (event.attendeeDomains ?? []).map((domain) => domain.toLowerCase());
  const matches = candidates
    .filter((language) => language.code !== DEFAULT_LANGUAGE)
    .filter(({ calendarHints }) => {
      const byWord = calendarHints.keywords.some((word) => mentions(text, word.toLowerCase()));
      const byDomain = calendarHints.domains.some((suffix) =>
        domains.some((domain) => domain.endsWith(suffix)),
      );
      return byWord || byDomain;
    });
  return matches.length === 1 ? (matches[0]!.code as LanguageCode) : null;
}
