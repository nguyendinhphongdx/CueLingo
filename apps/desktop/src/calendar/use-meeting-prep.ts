import { SUPPORTED_LANGUAGES, type LanguageCode, type PrepCourseRequest } from '@cuelingo/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { coursesApi } from '../study/courses-api';
import { sessionsApi } from '../session/sessions-api';
import type { UpcomingMeeting } from './calendar-hint';
import { matchSessions } from './match-sessions';

/**
 * Preparation for the meeting in the hint: earlier meetings with the same title, matched here on the
 * device. Only their ids go to the API. Used only while a hint shows, so with calendar hints off it never runs.
 */
export function useMeetingPrep(hint: UpcomingMeeting, language: LanguageCode) {
  const sessions = useQuery({
    queryKey: ['calendar', 'prep-sessions'],
    queryFn: () => sessionsApi.list(),
    retry: false,
  });
  const sessionIds = matchSessions(hint.title, sessions.data?.sessions ?? [], language);
  const prep = useMutation({
    mutationFn: () =>
      coursesApi.prep({ sessionIds, language: language as PrepCourseRequest['language'] }),
  });
  return {
    // Languages that are not studied have no phrases to prepare with.
    available: SUPPORTED_LANGUAGES[language].learnable && sessionIds.length > 0,
    prepare: () => prep.mutate(),
    preparing: prep.isPending,
    failed: prep.isError,
    result: prep.data ?? null,
  };
}
