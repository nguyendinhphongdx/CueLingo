import { subscribeGlossaryChanges } from '../lib/glossary-changes';
import type { SessionController } from './session-controller';

/** A glossary edit on the Terms page reaches the running meeting's speech model. Returns the unsubscribe. */
export function refreshOnGlossaryChange(
  controller: Pick<SessionController, 'refreshVocabulary'>,
): () => void {
  return subscribeGlossaryChanges(() => controller.refreshVocabulary());
}
