import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  languageOptions,
  learnableLanguageOptions,
  type LanguageCode,
} from '@cuelingo/shared';
import { useSettings } from './settings-store';

/** The language a new meeting uses, remembered between runs. Any language a meeting may use. */
export function useLanguage() {
  const language = useSettings((state) => state.language);
  const setLanguage = useSettings((state) => state.setLanguage);
  return { language, setLanguage, options: languageOptions() };
}

/**
 * The language learner screens (review, phrases, glossary, progress, placement) show. Shares the stored
 * choice with the meeting language, but a meeting-only language (Vietnamese) falls back to English.
 */
export function useLearnLanguage() {
  const stored = useSettings((state) => state.language);
  const setLanguage = useSettings((state) => state.setLanguage);
  return { language: toLearnLanguage(stored), setLanguage, options: learnableLanguageOptions() };
}

/** The language to study for a stored choice: itself when learnable, otherwise the default. */
export function toLearnLanguage(code: LanguageCode): LanguageCode {
  return SUPPORTED_LANGUAGES[code].learnable ? code : DEFAULT_LANGUAGE;
}
