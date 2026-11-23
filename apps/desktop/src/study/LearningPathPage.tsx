import { Button } from '@cuelingo/ui/components/button';
import { LearningPathPanel } from '@cuelingo/ui/components/learning-path-panel';
import { useState } from 'react';
import { useLearnLanguage } from '../settings';
import { ReviewPage } from './ReviewPage';
import { courseQueueSource, useLearningPath } from './use-learning-path';

/**
 * The Lộ trình tab: courses made from meetings. A sitting runs on the same review screen as the
 * Hôm nay tab, only with the cards of the course.
 */
export function LearningPathPage() {
  const path = useLearningPath(useLearnLanguage().language);
  const [studying, setStudying] = useState<string | null>(null);

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
        <ReviewPage source={courseQueueSource(studying)} />
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
    />
  );
}
