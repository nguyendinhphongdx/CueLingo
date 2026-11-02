import type { LanguageCode, Progress } from '@cuelingo/shared';
import { useCallback, useEffect, useState } from 'react';
import { describeInsightsError, insightsApi, type InsightsApi } from './insights-api';

export function useProgress(language: LanguageCode, api: InsightsApi = insightsApi) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProgress(await api.getProgress(language));
    } catch (cause) {
      setError(describeInsightsError(cause));
    } finally {
      setLoading(false);
    }
  }, [api, language]);

  useEffect(() => {
    void load();
  }, [load]);

  return { progress, loading, error, retry: load };
}
