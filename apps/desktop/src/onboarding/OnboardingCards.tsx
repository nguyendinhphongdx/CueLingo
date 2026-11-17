import { Button } from '@cuelingo/ui/components/button';
import { NoticeStrip } from '@cuelingo/ui/components/notice-strip';
import { useState } from 'react';
import { useMe } from '../auth';
import {
  advanceProgress,
  ONBOARDING_STEPS,
  pendingSteps,
  readProgress,
  writeProgress,
  type OnboardingProgress,
} from './onboarding-storage';

/** More open steps than this fold into one "Còn N bước" card, so the home page is not a wall of notices. */
export const MAX_SEPARATE_CARDS = 2;

/** Pure cards: one per step that was skipped or not reached (or one summary card when there are many). */
export function OnboardingCardsView({
  steps,
  onResume,
  onHide,
}: {
  steps: readonly number[];
  onResume(step: number): void;
  onHide(steps: readonly number[]): void;
}) {
  if (steps.length === 0) return null;
  const grouped = steps.length > MAX_SEPARATE_CARDS;
  const cards = grouped ? [steps] : steps.map((step) => [step]);
  return (
    <section aria-label="Việc còn lại khi làm quen" className="flex flex-col gap-2">
      {cards.map((group) => (
        <NoticeStrip
          key={group.join('-')}
          tone="info"
          action={
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="cursor-pointer"
                onClick={() => onHide(group)}
              >
                Ẩn
              </Button>
              <Button size="sm" className="cursor-pointer" onClick={() => onResume(group[0]!)}>
                Làm ngay
              </Button>
            </div>
          }
        >
          <p className="font-medium">
            {grouped
              ? `Còn ${group.length} bước để làm quen`
              : `Chưa xong: ${ONBOARDING_STEPS[group[0]!]?.label}`}
          </p>
          {grouped ? (
            <p className="text-body-sm">
              {group.map((step) => ONBOARDING_STEPS[step]?.label).join(', ')}
            </p>
          ) : null}
        </NoticeStrip>
      ))}
    </section>
  );
}

/** What is left of the guide, on the home page. Hidden for anyone who finished it all (or the older guide). */
export function OnboardingCards({ onResume }: { onResume(step: number): void }) {
  const { me } = useMe();
  const userId = me?.id ?? 'dev';
  const [progress, setProgress] = useState<OnboardingProgress | null>(() => readProgress(userId));
  return (
    <OnboardingCardsView
      steps={pendingSteps(progress)}
      onResume={onResume}
      onHide={(hidden) => {
        const next = hidden.reduce(
          (acc, step) => advanceProgress(acc, step, progress?.step ?? 0),
          progress,
        ) as OnboardingProgress;
        writeProgress(userId, next);
        setProgress(next);
      }}
    />
  );
}
