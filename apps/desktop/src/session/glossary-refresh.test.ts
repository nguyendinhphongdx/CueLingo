import { describe, expect, it, vi } from 'vitest';
import { notifyGlossaryChanged } from '../lib/glossary-changes';
import { refreshOnGlossaryChange } from './glossary-refresh';

describe('refreshOnGlossaryChange', () => {
  it('refreshes the vocabulary on each glossary change until unsubscribed', () => {
    const controller = { refreshVocabulary: vi.fn() };
    const unsubscribe = refreshOnGlossaryChange(controller);

    notifyGlossaryChanged();
    notifyGlossaryChanged();
    expect(controller.refreshVocabulary).toHaveBeenCalledTimes(2);

    unsubscribe();
    notifyGlossaryChanged();
    expect(controller.refreshVocabulary).toHaveBeenCalledTimes(2);
  });
});
