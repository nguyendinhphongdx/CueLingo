import type { LanguageCode } from '@cuelingo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coursesApi } from './courses-api';
import type { QueueSource } from './use-review';

const COURSES_ROOT = ['study', 'courses'] as const;

/** The cards of the next sitting of one course (listen-and-type included), as ordinary review cards. */
export const courseQueueSource = (sessionId: string): QueueSource => ({
  key: [...COURSES_ROOT, 'queue', sessionId],
  load: () => coursesApi.queue(sessionId, { dictation: true }),
});

export function useLearningPath(language: LanguageCode) {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: [...COURSES_ROOT, language],
    queryFn: () => coursesApi.list(language),
  });
  const start = useMutation({
    mutationFn: (sessionId: string) => coursesApi.start(sessionId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: COURSES_ROOT }),
        // Starting adds phrases to the Phrase Bank, which the other tabs show.
        queryClient.invalidateQueries({ queryKey: ['study'] }),
      ]),
  });
  return {
    data: list.data,
    loading: list.isPending,
    error: list.isError ? 'Không tải được lộ trình. Các tab khác vẫn dùng được.' : null,
    /** A failed start does not hide the list. */
    actionError: start.isError ? 'Không thể bắt đầu khoá. Hãy thử lại.' : null,
    startingId: start.isPending ? (start.variables ?? null) : null,
    start: start.mutateAsync,
    refresh: () => queryClient.invalidateQueries({ queryKey: COURSES_ROOT }),
  };
}
