/** Pure state rules for the inline speaker rename field and the "rebuild debrief" prompt. */

/** The one sentence whose speaker tag is currently an input. */
export interface RenameTarget {
  speakerId: string;
  segmentId: string;
}

/** Only the clicked sentence opens the field; other sentences of the same person keep their tag. */
export function isRenameOpen(target: RenameTarget | null, segmentId: string, speakerId: string) {
  return target !== null && target.segmentId === segmentId && target.speakerId === speakerId;
}

export type RenameSubmit =
  { kind: 'ignore' } | { kind: 'cancel' } | { kind: 'save'; name: string | null };

/** Enter pressed: nothing while a save runs, close when unchanged, else save (empty = remove name). */
export function decideRenameSubmit(value: string, initial: string, saving: boolean): RenameSubmit {
  if (saving) return { kind: 'ignore' };
  const name = value.trim();
  if (name === initial.trim()) return { kind: 'cancel' };
  return { kind: 'save', name: name || null };
}

/** Leaving the field cancels, except while saving (a failed save keeps the field open). */
export function shouldCancelOnBlur(saving: boolean) {
  return !saving;
}

export function shouldCancelOnKey(key: string) {
  return key === 'Escape';
}

export type RegeneratePrompt = 'ask' | 'waiting' | 'retry' | null;

/**
 * What the rebuild prompt shows. `waiting` lasts until a newer debrief arrives or the wait expires;
 * `retry` lets the person press the button again.
 */
export function regeneratePromptState(input: {
  namesChanged: boolean;
  replacingId: string | null;
  currentId: string | undefined;
  expired: boolean;
}): RegeneratePrompt {
  if (input.namesChanged) return 'ask';
  if (input.replacingId && input.currentId === input.replacingId)
    return input.expired ? 'retry' : 'waiting';
  return null;
}
