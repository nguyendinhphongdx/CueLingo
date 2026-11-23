import type { LanguageCode, ReviewQueue } from '@cuelingo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';

const COURSES_ROOT = ['courses'] as const;

/** Where a sitting's cards come from; the review feature's `useReview` takes the same shape. */
export interface QueueSource {
  key: readonly unknown[];
  load: () => Promise<ReviewQueue>;
}

/** The cards of the next sitting of one course, asked as ordinary review cards (listen-and-type included). */
export const courseQueueSource = (sessionId: string): QueueSource => ({
  key: [...COURSES_ROOT, 'queue', sessionId],
  load: () => client.courses.queue(sessionId, { dictation: true }),
});

/** State + actions for the learning path tab. UI components stay free of API calls. */
export function useLearningPath(language: LanguageCode) {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: [...COURSES_ROOT, language],
    queryFn: () => client.courses.list(language),
  });
  const start = useMutation({
    mutationFn: (sessionId: string) => client.courses.start(sessionId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: COURSES_ROOT }),
        // Starting adds phrases to the Phrase Bank, which other tabs show.
        queryClient.invalidateQueries({ queryKey: ['phrases'] }),
        queryClient.invalidateQueries({ queryKey: ['review'] }),
      ]),
  });

  return {
    data: list.data,
    loading: list.isPending,
    error: describeError(list.error),
    /** A failed start does not hide the list. */
    actionError: describeError(start.error),
    startingId: start.isPending ? (start.variables ?? null) : null,
    start: start.mutateAsync,
    /** Refresh the list after a sitting so progress is up to date. */
    refresh: () => queryClient.invalidateQueries({ queryKey: COURSES_ROOT }),
  };
}
