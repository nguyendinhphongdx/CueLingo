import type {
  CreateGlossaryTermInput,
  GlossaryTerm,
  LanguageCode,
  UpdateGlossaryTerm,
} from '@cuelingo/shared';
import { useCallback, useEffect, useState } from 'react';
import { notifyGlossaryChanged } from '../lib/glossary-changes';
import { describeInsightsError, insightsApi, type InsightsApi } from './insights-api';

export function useGlossary(language: LanguageCode, api: InsightsApi = insightsApi) {
  const [items, setItems] = useState<GlossaryTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.listGlossary(language));
    } catch (cause) {
      setError(describeInsightsError(cause));
    } finally {
      setLoading(false);
    }
  }, [api, language]);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = async (action: () => Promise<unknown>) => {
    setSaving(true);
    setError(null);
    try {
      await action();
      notifyGlossaryChanged();
      await load();
      return true;
    } catch (cause) {
      setError(describeInsightsError(cause));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    items,
    loading,
    saving,
    error,
    add: (input: Omit<CreateGlossaryTermInput, 'language'>) =>
      mutate(() => api.createGlossary({ ...input, language })),
    update: (id: string, patch: UpdateGlossaryTerm) => mutate(() => api.updateGlossary(id, patch)),
    remove: (id: string) => mutate(() => api.removeGlossary(id)),
    retry: load,
  };
}
