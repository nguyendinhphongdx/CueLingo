'use client';

import type { LanguageCode } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { LearningPathPanel } from '@cuelingo/ui/components/learning-path-panel';
import { useState, type ReactNode } from 'react';
import { GoalEditor, GoalLessonPage, useGoals } from '../goals';
import { courseQueueSource, useLearningPath, type QueueSource } from './use-learning-path';

/** Shown with an error while the goals cannot be listed, so the person still sees why. */
const NO_GOALS = { goals: [], nextUp: null };

/** What the tab shows besides the list: the goal form, or one lesson of a goal. */
type GoalView =
  | { kind: 'pick' }
  | { kind: 'edit'; goalId: string }
  | { kind: 'lesson'; goalId: string; lessonKey: string };

/**
 * The Lộ trình tab: courses made from meetings. A sitting runs on the same review screen as the
 * Hôm nay tab, only with the cards of the course: the review feature passes it in as `renderSitting`
 * (features reach each other through their index, and review already shows this tab).
 * Goals (AI lessons for a goal the person picked) sit beside them, for English only. If the courses
 * or the goals cannot load, the other tabs still work.
 */
export function LearningPathTab({
  language,
  renderSitting,
}: {
  language: LanguageCode;
  renderSitting: (source: QueueSource) => ReactNode;
}) {
  const path = useLearningPath(language);
  const [studying, setStudying] = useState<string | null>(null);
  const [goalView, setGoalView] = useState<GoalView | null>(null);
  // Goals are English only in this version.
  const goals = useGoals(language === 'en');
  const goalList = goals.data?.goals ?? [];
  const backToPath = () => {
    setGoalView(null);
    void goals.refresh();
  };

  if (goalView?.kind === 'lesson') {
    return (
      <GoalLessonPage goalId={goalView.goalId} lessonKey={goalView.lessonKey} onBack={backToPath} />
    );
  }
  if (goalView?.kind === 'pick' || goalView?.kind === 'edit') {
    const editing =
      goalView.kind === 'edit' ? goalList.find((goal) => goal.id === goalView.goalId) : undefined;
    return <GoalEditor goals={goalList} editing={editing} onDone={backToPath} />;
  }

  if (studying) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStudying(null);
              void path.refresh();
            }}
          >
            Quay lại lộ trình
          </Button>
        </div>
        {renderSitting(courseQueueSource(studying))}
      </div>
    );
  }

  return (
    <LearningPathPanel
      data={path.data}
      loading={path.loading}
      error={path.error}
      actionError={path.actionError}
      busySessionId={path.startingId}
      onStart={(sessionId) => {
        void path.start(sessionId).then(
          () => setStudying(sessionId),
          () => undefined,
        );
      }}
      onContinue={setStudying}
      goals={goals.data ?? (goals.listError ? NO_GOALS : undefined)}
      goalError={goals.listError ?? goals.removeError}
      onOpenLesson={(goalId, lessonKey) => setGoalView({ kind: 'lesson', goalId, lessonKey })}
      onAddGoal={language === 'en' ? () => setGoalView({ kind: 'pick' }) : undefined}
      onEditGoal={(goalId) => setGoalView({ kind: 'edit', goalId })}
      onRemoveGoal={(goalId) => void goals.remove(goalId).catch(() => undefined)}
    />
  );
}
