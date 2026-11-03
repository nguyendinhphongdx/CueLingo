/** Tells the running session that the person's glossary changed, so it can refresh the speech model's terms. */
const listeners = new Set<() => void>();

export function subscribeGlossaryChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyGlossaryChanged(): void {
  listeners.forEach((listener) => listener());
}
