import { languageOptions } from '@cuelingo/shared';
import { useSettings } from './settings-store';

/** The language a screen shows (or a new meeting uses), remembered between runs. */
export function useLanguage() {
  const language = useSettings((state) => state.language);
  const setLanguage = useSettings((state) => state.setLanguage);
  return { language, setLanguage, options: languageOptions() };
}
