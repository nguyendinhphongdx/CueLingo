export const onboardingKey = (userId: string) => `cuelingo.onboarded.${userId}`;

type OnboardingStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type OnboardingMode = 'auto' | 'open' | 'complete';

export function hasCompletedOnboarding(userId: string, storage?: OnboardingStorage) {
  try {
    return (storage ?? globalThis.localStorage).getItem(onboardingKey(userId)) === 'true';
  } catch {
    return false;
  }
}

export function completeOnboarding(userId: string, storage?: OnboardingStorage) {
  try {
    (storage ?? globalThis.localStorage).setItem(onboardingKey(userId), 'true');
  } catch {
    // Storage can be unavailable in a restricted webview. Completion still applies to this session.
  }
}

export function clearOnboarding(userId: string, storage?: OnboardingStorage) {
  try {
    (storage ?? globalThis.localStorage).removeItem(onboardingKey(userId));
  } catch {
    // The caller opens onboarding for this session even when the stored flag cannot be removed.
  }
}

export function shouldShowOnboarding(
  mode: OnboardingMode,
  userId: string,
  storage?: OnboardingStorage,
) {
  if (mode === 'open') return true;
  if (mode === 'complete') return false;
  return !hasCompletedOnboarding(userId, storage);
}

/** The six steps, in order. A step is `done` once its forward button was pressed; "Để sau" leaves it open. */
export const ONBOARDING_STEPS = [
  { id: 'welcome', label: 'Chào bạn' },
  { id: 'permissions', label: 'Quyền truy cập' },
  { id: 'model', label: 'Mô hình' },
  { id: 'profile', label: 'Mức hỗ trợ' },
  { id: 'listening', label: 'Bài nghe' },
  { id: 'shortcuts', label: 'Phím tắt' },
] as const;

export interface OnboardingProgress {
  /** The step to resume at. */
  step: number;
  done: number[];
}

export const progressKey = (userId: string) => `cuelingo.onboarding-progress.${userId}`;

const clampStep = (step: number) =>
  Math.min(Math.max(Math.trunc(step), 0), ONBOARDING_STEPS.length - 1);

/** Where the person left off; null when nothing was saved (everyone who finished the older guide). */
export function readProgress(
  userId: string,
  storage?: OnboardingStorage,
): OnboardingProgress | null {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(progressKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { step, done } = parsed as { step?: unknown; done?: unknown };
    return {
      step: typeof step === 'number' && Number.isFinite(step) ? clampStep(step) : 0,
      done: Array.isArray(done)
        ? [
            ...new Set(
              done.filter(
                (n): n is number => Number.isInteger(n) && n >= 0 && n < ONBOARDING_STEPS.length,
              ),
            ),
          ]
        : [],
    };
  } catch {
    return null;
  }
}

export function writeProgress(
  userId: string,
  progress: OnboardingProgress,
  storage?: OnboardingStorage,
) {
  try {
    (storage ?? globalThis.localStorage).setItem(progressKey(userId), JSON.stringify(progress));
  } catch {
    // Progress is only a convenience; the guide still works for this session.
  }
}

/** Marks a step done and moves the resume point to `step`. */
export function advanceProgress(
  progress: OnboardingProgress | null,
  finished: number,
  step: number,
): OnboardingProgress {
  const done = new Set(progress?.done ?? []);
  done.add(finished);
  return { step: clampStep(step), done: [...done].sort((a, b) => a - b) };
}

/**
 * The steps still open once the guide is closed, shown as cards on the home page. The welcome step is
 * not a task. Without saved progress there is nothing to offer.
 */
export function pendingSteps(progress: OnboardingProgress | null): number[] {
  if (!progress) return [];
  return ONBOARDING_STEPS.map((_, index) => index).filter(
    (index) => index > 0 && !progress.done.includes(index),
  );
}
