import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type LanguageCode } from '@cuelingo/shared';

/** The name of a language as prompts (written in English) refer to it. English when `code` is left out. */
export const promptLanguage = (code: LanguageCode = DEFAULT_LANGUAGE): string =>
  SUPPORTED_LANGUAGES[code].promptName;

/** The same language in Vietnamese and lower case, for the Vietnamese debrief prompt. */
export const viLanguage = (code: LanguageCode = DEFAULT_LANGUAGE): string =>
  SUPPORTED_LANGUAGES[code].name.toLowerCase();

export const languageHasReading = (code: LanguageCode = DEFAULT_LANGUAGE): boolean =>
  SUPPORTED_LANGUAGES[code].hasReading;

/** `a` or `an` for a language name, so prompts read "a Japanese" and "an English". */
export const withArticle = (name: string): string =>
  `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
