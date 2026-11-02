import { DEFAULT_LANGUAGE, languageOptions, type LanguageCode } from '@cuelingo/shared';
import { create } from 'zustand';

export type SelectableAssistLevel = 4 | 3 | 1 | 0;

const LANGUAGE_KEY = 'cuelingo.language';

/** The language last used, so the next meeting and every learning screen start from it. */
function readLanguage(): LanguageCode {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_KEY);
    const found = languageOptions().find((option) => option.value === stored);
    return found?.value ?? DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

interface SettingsState {
  assistLevel: SelectableAssistLevel;
  setAssistLevel: (level: SelectableAssistLevel) => void;
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  assistLevel: 4,
  setAssistLevel: (assistLevel) => set({ assistLevel }),
  language: readLanguage(),
  setLanguage: (language) => {
    try {
      window.localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // Not remembered, but the choice still applies for this run.
    }
    set({ language });
  },
}));
