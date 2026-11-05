import { describe, expect, it } from 'vitest';
import {
  decideRenameSubmit,
  isRenameOpen,
  regeneratePromptState,
  shouldCancelOnBlur,
  shouldCancelOnKey,
} from './rename-state';

describe('rename field state', () => {
  it('opens the field only on the clicked sentence, never on the same speaker elsewhere', () => {
    const target = { speakerId: 's1', segmentId: 'a' };
    expect(isRenameOpen(target, 'a', 's1')).toBe(true);
    expect(isRenameOpen(target, 'b', 's1')).toBe(false);
    expect(isRenameOpen(null, 'a', 's1')).toBe(false);
  });

  it('Enter saves a changed name, removes it when empty, closes when unchanged', () => {
    expect(decideRenameSubmit(' Lan ', '', false)).toEqual({ kind: 'save', name: 'Lan' });
    expect(decideRenameSubmit('  ', 'Lan', false)).toEqual({ kind: 'save', name: null });
    expect(decideRenameSubmit('Lan', 'Lan', false)).toEqual({ kind: 'cancel' });
    expect(decideRenameSubmit('Minh', 'Lan', true)).toEqual({ kind: 'ignore' });
  });

  it('Esc and blur cancel, but blur is ignored while saving so a failed save keeps the field', () => {
    expect(shouldCancelOnKey('Escape')).toBe(true);
    expect(shouldCancelOnKey('a')).toBe(false);
    expect(shouldCancelOnBlur(false)).toBe(true);
    expect(shouldCancelOnBlur(true)).toBe(false);
  });
});

describe('regeneratePromptState', () => {
  const base = { namesChanged: false, replacingId: 'd1', currentId: 'd1', expired: false };

  it('asks after a rename, waits for the rebuild, offers a retry once the wait expired', () => {
    expect(regeneratePromptState({ ...base, namesChanged: true })).toBe('ask');
    expect(regeneratePromptState(base)).toBe('waiting');
    expect(regeneratePromptState({ ...base, expired: true })).toBe('retry');
  });

  it('shows nothing once a newer debrief arrived or nothing is being replaced', () => {
    expect(regeneratePromptState({ ...base, currentId: 'd2' })).toBeNull();
    expect(regeneratePromptState({ ...base, replacingId: null })).toBeNull();
  });
});
