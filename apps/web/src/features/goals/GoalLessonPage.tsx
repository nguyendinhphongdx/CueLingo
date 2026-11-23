'use client';

import { GoalLessonView } from '@cuelingo/ui/components/goal-lesson-view';
import { client } from '../../lib/client';
import { useGoalLesson } from './use-goals';

/** One goal lesson on the web. The audio comes from the shared TTS cache, one fixed voice per speaker. */
export function GoalLessonPage({
  goalId,
  lessonKey,
  onBack,
}: {
  goalId: string;
  lessonKey: string;
  onBack: () => void;
}) {
  const state = useGoalLesson(goalId, lessonKey);
  return (
    <GoalLessonView
      lesson={state.lesson}
      loading={state.loading}
      error={state.error}
      onRetry={state.retry}
      onBack={onBack}
      loadAudio={client.tts.speak}
      onPractice={state.practice}
      onSubmitQuiz={state.submitQuiz}
      onReport={state.report}
    />
  );
}
