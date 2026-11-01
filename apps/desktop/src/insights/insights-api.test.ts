import { describe, expect, it, vi } from 'vitest';
import { createInsightsApi, describeInsightsError } from './insights-api';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('insights api', () => {
  it('uses the glossary contracts for list, create, update and delete', async () => {
    const item = {
      id: '11111111-1111-4111-8111-111111111111',
      term: 'Product discovery',
      translation: 'Khám phá sản phẩm',
      note: null,
      createdAt: '2026-11-01T00:00:00.000Z',
    };
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ items: [item] }))
      .mockResolvedValueOnce(json(item, 201))
      .mockResolvedValueOnce(json({ ...item, note: 'Dùng trong planning' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = createInsightsApi({
      apiUrl: 'ws://localhost:4000/',
      token: 'token',
      fetch: request,
    });

    expect(await api.listGlossary()).toEqual([item]);
    await api.createGlossary({ term: item.term, translation: item.translation, note: null });
    await api.updateGlossary(item.id, { note: 'Dùng trong planning' });
    await api.removeGlossary(item.id);

    expect(request).toHaveBeenNthCalledWith(
      4,
      `http://localhost:4000/v1/glossary/${item.id}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('turns a duplicate API error into a Vietnamese message', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        json({ error: { code: 'CONFLICT', message: 'Term already exists' } }, 409),
      );
    const api = createInsightsApi({
      apiUrl: 'http://localhost:4000',
      token: 'token',
      fetch: request,
    });

    let error: unknown;
    try {
      await api.createGlossary({ term: 'Product discovery' });
    } catch (cause) {
      error = cause;
    }

    expect(describeInsightsError(error)).toBe('Thuật ngữ này đã có trong danh sách');
  });
});
