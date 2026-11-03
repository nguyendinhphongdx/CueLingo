import type { GlossaryTerm } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { subscribeGlossaryChanges } from '../lib/glossary-changes';
import type { InsightsApi } from './insights-api';
import { useGlossary } from './use-glossary';

const term: GlossaryTerm = {
  id: '11111111-1111-4111-8111-111111111111',
  term: 'SLA',
  translation: null,
  note: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  language: 'en',
};

function fakeApi(fail = false): InsightsApi {
  const act = vi.fn(async () => {
    if (fail) throw new Error('boom');
    return term;
  });
  return {
    listGlossary: vi.fn(async () => [term]),
    createGlossary: act,
    updateGlossary: act,
    removeGlossary: vi.fn(async () => {
      if (fail) throw new Error('boom');
    }),
    getProgress: vi.fn(),
  } as unknown as InsightsApi;
}

// No DOM in this package's tests: render once on the server to get the hook's actions.
function glossaryActions(api: InsightsApi) {
  let result!: ReturnType<typeof useGlossary>;
  function Probe() {
    result = useGlossary('en', api);
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return result;
}

describe('useGlossary change notification', () => {
  it('notifies after a successful add, update and remove', async () => {
    const listener = vi.fn();
    const off = subscribeGlossaryChanges(listener);
    const glossary = glossaryActions(fakeApi());

    await glossary.add({ term: 'SLA' });
    await glossary.update(term.id, { note: 'x' });
    await glossary.remove(term.id);
    off();

    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('does not notify when the change fails', async () => {
    const listener = vi.fn();
    const off = subscribeGlossaryChanges(listener);
    const glossary = glossaryActions(fakeApi(true));

    await glossary.add({ term: 'SLA' });
    await glossary.remove(term.id);
    off();

    expect(listener).not.toHaveBeenCalled();
  });
});
