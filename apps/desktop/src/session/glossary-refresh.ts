import { subscribeGlossaryChanges } from '../lib/glossary-changes';
import type { SessionController } from './session-controller';

/** How often a running meeting re-reads the glossary, to pick up terms added somewhere else (the web app). */
export const GLOSSARY_POLL_MS = 2 * 60 * 1000;

/**
 * Keeps the running meeting's speech model in step with the person's glossary. A change made on the Terms
 * page of this app arrives at once; a change made on the web reaches it within two minutes. Both are
 * no-ops when no meeting runs (the controller does not call the API then). Returns the unsubscribe.
 */
export function refreshOnGlossaryChange(
  controller: Pick<SessionController, 'refreshVocabulary'>,
  pollMs: number = GLOSSARY_POLL_MS,
): () => void {
  const unsubscribe = subscribeGlossaryChanges(() => controller.refreshVocabulary());
  const timer = setInterval(() => controller.refreshVocabulary(), pollMs);
  return () => {
    unsubscribe();
    clearInterval(timer);
  };
}
