import { scorePlacement } from '@cuelingo/learner-model';
import {
  DEFAULT_LANGUAGE,
  ErrorCode,
  type LanguageCode,
  type PlacementResult,
  type PlacementTest,
  type SubmitPlacementRequest,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import { placementItems } from './placement.content';
import type { PlacementRepository } from './placement.repository';

export type PlacementService = ReturnType<typeof createPlacementService>;

export function createPlacementService(repo: PlacementRepository) {
  const itemsFor = (language: LanguageCode) => {
    const items = placementItems(language);
    if (!items) throw new AppError(ErrorCode.NotFound, 'No placement test for this language yet');
    return items;
  };

  return {
    /** The passages and questions, without the answers. */
    test(language: LanguageCode): PlacementTest {
      return {
        language,
        passages: itemsFor(language).map(({ correctChoice: _answer, ...passage }) => passage),
      };
    },

    /**
     * Scores the answers (a passage left out counts as wrong) and saves the level and the starting
     * assist level for that language. Taking the test again replaces them.
     */
    async submit(userId: string, input: SubmitPlacementRequest): Promise<PlacementResult> {
      const language = input.language ?? DEFAULT_LANGUAGE;
      const items = itemsFor(language);
      const chosen = new Map(input.answers.map((answer) => [answer.passageId, answer.choice]));
      const outcome = scorePlacement(
        items.map((item) => chosen.get(item.id) === item.correctChoice),
      );
      await repo.save(userId, language, {
        listeningLevel: outcome.listeningLevel,
        assistDefault: outcome.assistDefault,
      });
      return {
        language,
        correct: outcome.correct,
        total: outcome.total,
        listeningLevel: outcome.listeningLevel,
        assistDefault: outcome.assistDefault,
        answers: items.map((item) => ({ passageId: item.id, correctChoice: item.correctChoice })),
      };
    },
  };
}
