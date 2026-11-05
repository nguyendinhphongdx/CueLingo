import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyGlossaryChanged } from '../lib/glossary-changes';
import { GLOSSARY_POLL_MS, refreshOnGlossaryChange } from './glossary-refresh';

describe('refreshOnGlossaryChange', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

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

  // AC13: a term added on the web while a meeting runs reaches the speech model within two minutes.
  it('re-reads the glossary every two minutes so an edit made on the web arrives', () => {
    const controller = { refreshVocabulary: vi.fn() };
    const unsubscribe = refreshOnGlossaryChange(controller);

    vi.advanceTimersByTime(GLOSSARY_POLL_MS - 1);
    expect(controller.refreshVocabulary).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(controller.refreshVocabulary).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(GLOSSARY_POLL_MS);
    expect(controller.refreshVocabulary).toHaveBeenCalledTimes(2);

    unsubscribe();
    vi.advanceTimersByTime(GLOSSARY_POLL_MS * 3);
    expect(controller.refreshVocabulary).toHaveBeenCalledTimes(2);
  });
});
