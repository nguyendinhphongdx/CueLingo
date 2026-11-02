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
    /** On-device recognition model the sidecar loads for this language. */
    recognizer: 'parakeet-tdt-v2-en',
    /** How words are told apart, for tap-to-look-up and typed answers. */
    wordBreaks: 'spaces',
    /** Whether a reading (such as furigana) accompanies words. */
    hasReading: false,
    /** Switched on for people. A language stays off until it passes its evaluation. */
    enabled: true,
  },
  ja: {
    code: 'ja',
    name: 'Tiếng Nhật',
    nativeName: '日本語',
    recognizer: 'parakeet-tdt-ja',
    wordBreaks: 'dictionary',
    hasReading: true,
    enabled: false,
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

/** Languages a person may pick today. */
export const enabledLanguages = (): LanguageInfo[] =>
  Object.values(SUPPORTED_LANGUAGES).filter((language) => language.enabled);
