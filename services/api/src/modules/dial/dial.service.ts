import { suggestAssistLevel } from '@cuelingo/learner-model';
import type { AssistSuggestion } from '@cuelingo/shared';
import type { DialRepository } from './dial.repository';

export type DialService = ReturnType<typeof createDialService>;

export function createDialService(repo: DialRepository, clock: () => Date = () => new Date()) {
  return {
    /** The rules decide; this only gathers the facts and hands back the answer. */
    async suggestion(userId: string): Promise<AssistSuggestion> {
      const facts = await repo.facts(userId);
      return suggestAssistLevel(facts.currentLevel, facts.meetings, {
        lastDecisionAt: facts.lastDecisionAt,
        now: clock(),
      });
    },
  };
}
