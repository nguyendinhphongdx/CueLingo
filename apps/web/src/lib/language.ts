import { DEFAULT_LANGUAGE, languageOptions, type LanguageCode } from '@cuelingo/shared';
import { useStoredChoice } from '@cuelingo/ui/hooks/use-stored-choice';

/** The language whose learning data a screen shows; remembered between visits. */
export function useLanguage() {
  const options = languageOptions();
  const [language, setLanguage] = useStoredChoice<LanguageCode>(
    'cuelingo.language',
    options.map((option) => option.value),
    DEFAULT_LANGUAGE,
  );
  return { language, setLanguage, options };
}
