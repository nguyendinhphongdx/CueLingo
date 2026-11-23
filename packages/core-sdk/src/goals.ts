import {
  GoalListSchema,
  GoalSchema,
  LessonViewSchema,
  PracticeFeedbackSchema,
  QuizResultSchema,
  type CreateGoalRequest,
  type Goal,
  type GoalList,
  type LessonReportRequest,
  type LessonView,
  type PracticeFeedback,
  type PracticeRequest,
  type QuizResult,
  type QuizSubmitRequest,
  type UpdateGoalRequest,
} from '@cuelingo/shared';
import type { Http } from './http';

const lessonPath = (goalId: string, lessonKey: string) =>
  `/v1/goals/${goalId}/lessons/${encodeURIComponent(lessonKey)}`;

/** Goal lessons (ADR 0025). The ids come from the server; the person's id is never sent. */
export function goalsApi(http: Http) {
  return {
    /** The person's goals with their six lessons and what to do next. */
    list(): Promise<GoalList> {
      return http.request('GET', '/v1/goals', GoalListSchema);
    },
    create(input: CreateGoalRequest): Promise<Goal> {
      return http.request('POST', '/v1/goals', GoalSchema, input);
    },
    update(id: string, patch: UpdateGoalRequest): Promise<Goal> {
      return http.request('PATCH', `/v1/goals/${id}`, GoalSchema, patch);
    },
    async remove(id: string): Promise<void> {
      await http.request('DELETE', `/v1/goals/${id}`, null);
    },
    /**
     * Opens a lesson; the first open makes it and takes one of the day's new lessons, which can take
     * up to 30 seconds. `signal` lets a screen stop waiting.
     */
    openLesson(
      goalId: string,
      lessonKey: string,
      init?: { signal?: AbortSignal },
    ): Promise<LessonView> {
      return http.request('GET', lessonPath(goalId, lessonKey), LessonViewSchema, undefined, init);
    },
    /** Feedback on one typed sentence; the sentence is not stored by the server. */
    practice(goalId: string, lessonKey: string, input: PracticeRequest): Promise<PracticeFeedback> {
      return http.request(
        'POST',
        `${lessonPath(goalId, lessonKey)}/practice`,
        PracticeFeedbackSchema,
        input,
      );
    },
    /** Graded by the server; also adds the key phrases to the Phrase Bank and writes the reviews. */
    submitQuiz(goalId: string, lessonKey: string, input: QuizSubmitRequest): Promise<QuizResult> {
      return http.request('POST', `${lessonPath(goalId, lessonKey)}/quiz`, QuizResultSchema, input);
    },
    async report(goalId: string, lessonKey: string, input: LessonReportRequest): Promise<void> {
      await http.request('POST', `${lessonPath(goalId, lessonKey)}/report`, null, input);
    },
  };
}
