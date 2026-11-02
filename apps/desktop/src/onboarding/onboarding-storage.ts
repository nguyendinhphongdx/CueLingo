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
