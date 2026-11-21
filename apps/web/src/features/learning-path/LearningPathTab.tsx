'use client';

import type { LanguageCode } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { LearningPathPanel } from '@cuelingo/ui/components/learning-path-panel';
import { useState, type ReactNode } from 'react';
import { courseQueueSource, useLearningPath, type QueueSource } from './use-learning-path';

/**
 * The Lộ trình tab: courses made from meetings. A sitting runs on the same review screen as the
 * Hôm nay tab, only with the cards of the course: the review feature passes it in as `renderSitting`
 * (features reach each other through their index, and review already shows this tab).
 * If the courses cannot load, the other tabs still work.
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
    />
  );
}
