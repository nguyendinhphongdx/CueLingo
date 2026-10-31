import type { CreateGlossaryTermInput, GlossaryTerm } from '@cuelingo/shared';
import { ApiError } from '@cuelingo/core-sdk';
import { useCallback, useEffect, useState } from 'react';
import { client } from '../../lib/client';

/** State + actions for the glossary screen. UI components stay free of API calls. */
export function useGlossary() {
  const [items, setItems] = useState<GlossaryTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đã có lỗi, vui lòng thử lại');
    }
  }, []);

  useEffect(() => {
    void run(async () => setItems(await client.glossary.list())).finally(() => setLoading(false));
  }, [run]);

  const add = (input: CreateGlossaryTermInput) =>
    run(async () => {
      const created = await client.glossary.create(input);
      setItems((prev) => [...prev, created]);
    });

  const remove = (id: string) =>
    run(async () => {
      await client.glossary.remove(id);
      setItems((prev) => prev.filter((t) => t.id !== id));
    });

  return { items, loading, error, add, remove };
}
