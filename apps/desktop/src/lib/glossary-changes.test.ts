import { describe, expect, it, vi } from 'vitest';
import { notifyGlossaryChanged, subscribeGlossaryChanges } from './glossary-changes';

describe('glossary changes', () => {
  it('notifies every subscriber until it unsubscribes', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeGlossaryChanges(a);
    subscribeGlossaryChanges(b)();

    notifyGlossaryChanged();
    offA();
    notifyGlossaryChanged();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });
});
