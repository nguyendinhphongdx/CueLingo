import type { CreateGlossaryTermInput, GlossaryTerm, UpdateGlossaryTerm } from '@cuelingo/shared';
import { useCallback, useEffect, useState } from 'react';
import { describeInsightsError, insightsApi, type InsightsApi } from './insights-api';

export function useGlossary(api: InsightsApi = insightsApi) {
  const [items, setItems] = useState<GlossaryTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.listGlossary());
    } catch (cause) {
      setError(describeInsightsError(cause));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = async (action: () => Promise<unknown>) => {
    setSaving(true);
    setError(null);
    try {
      await action();
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
    add: (input: CreateGlossaryTermInput) => mutate(() => api.createGlossary(input)),
    update: (id: string, patch: UpdateGlossaryTerm) => mutate(() => api.updateGlossary(id, patch)),
    remove: (id: string) => mutate(() => api.removeGlossary(id)),
    retry: load,
  };
}
