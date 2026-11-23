import { ApiError } from '@cuelingo/core-sdk';
import type {
  CreateGoalRequest,
  GoalLevel,
  LessonReportRequest,
  PracticeRequest,
  QuizSubmitRequest,
  UpdateGoalRequest,
} from '@cuelingo/shared';
import { lessonErrorMessage } from '@cuelingo/ui/lib/goal-lesson';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '../../lib/client';

const GOALS_ROOT = ['goals'] as const;
const lessonKeyOf = (goalId: string, lessonKey: string) =>
  [...GOALS_ROOT, 'lesson', goalId, lessonKey] as const;

type Action = Parameters<typeof lessonErrorMessage>[1];

/** Vietnamese text for an error thrown by core-sdk while using goals. */
export const goalErrorMessage = (error: unknown, action: Action): string =>
  lessonErrorMessage(error instanceof ApiError ? error : null, action);

/** The picker's value as the API wants it: no level or deadline sent when the person left them alone. */
export function toCreateRequest(value: {
  goalKey: string;
  level: string | null;
  deadline: string | null;
}): CreateGoalRequest {
  return {
    goalKey: value.goalKey as CreateGoalRequest['goalKey'],
    ...(value.level ? { level: value.level as GoalLevel } : {}),
    ...(value.deadline ? { deadline: value.deadline } : {}),
  };
}

/** Only what changed, so an edit that changes nothing sends nothing. */
export function toUpdateRequest(
  current: { level: string; deadline: string | null },
  value: { level: string | null; deadline: string | null },
): UpdateGoalRequest | null {
  const patch: UpdateGoalRequest = {};
  if (value.level && value.level !== current.level) patch.level = value.level as GoalLevel;
  if (value.deadline !== current.deadline) patch.deadline = value.deadline;
  return Object.keys(patch).length > 0 ? patch : null;
}

/** State + actions for the goals shown in the learning path. UI components stay free of API calls. */
export function useGoals(enabled: boolean) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: GOALS_ROOT });
  const list = useQuery({
    queryKey: [...GOALS_ROOT, 'list'],
    queryFn: () => client.goals.list(),
    enabled,
  });
  const create = useMutation({
    mutationFn: (input: CreateGoalRequest) => client.goals.create(input),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: UpdateGoalRequest }) =>
      client.goals.update(input.id, input.patch),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => client.goals.remove(id),
    onSuccess: refresh,
  });

  return {
    data: list.data,
    /** A failed list hides only the goals; the courses from meetings and the other tabs keep working. */
    listError: list.error ? goalErrorMessage(list.error, 'list') : null,
    create: create.mutateAsync,
    creating: create.isPending,
    createError: create.error ? goalErrorMessage(create.error, 'goal') : null,
    resetCreate: create.reset,
    update: update.mutateAsync,
    updating: update.isPending,
    updateError: update.error ? goalErrorMessage(update.error, 'goal') : null,
    resetUpdate: update.reset,
    remove: remove.mutateAsync,
    removeError: remove.error ? goalErrorMessage(remove.error, 'goal') : null,
    refresh,
  };
}

/**
 * One lesson. The first open makes it (about 15 to 25 seconds); a lesson opened before comes straight back.
 * Practice, the quiz and the report all throw an `Error` with a Vietnamese message.
 */
export function useGoalLesson(goalId: string, lessonKey: string) {
  const queryClient = useQueryClient();
  const lesson = useQuery({
    queryKey: lessonKeyOf(goalId, lessonKey),
    queryFn: ({ signal }) => client.goals.openLesson(goalId, lessonKey, { signal }),
    // A retry would start a second generation behind the person's back.
    retry: false,
    refetchOnWindowFocus: false,
  });

  async function guarded<T>(action: Action, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw new Error(goalErrorMessage(error, action), { cause: error });
    }
  }

  return {
    lesson: lesson.data,
    loading: lesson.isPending,
    error: lesson.error ? goalErrorMessage(lesson.error, 'open') : null,
    retry: () => void lesson.refetch(),
    practice: (promptIndex: number, sentence: string) =>
      guarded('practice', () =>
        client.goals.practice(goalId, lessonKey, {
          promptIndex,
          sentence,
        } satisfies PracticeRequest),
      ),
    submitQuiz: (answers: QuizSubmitRequest['answers']) =>
      guarded('quiz', async () => {
        const result = await client.goals.submitQuiz(goalId, lessonKey, { answers });
        // Progress changed, and the quiz added phrases and reviews that other tabs show.
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: GOALS_ROOT }),
          queryClient.invalidateQueries({ queryKey: ['phrases'] }),
          queryClient.invalidateQueries({ queryKey: ['review'] }),
        ]);
        return result;
      }),
    report: (reason: LessonReportRequest['reason']) =>
      guarded('report', () => client.goals.report(goalId, lessonKey, { reason })),
  };
}
