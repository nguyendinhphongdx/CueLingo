/**
 * Onboarding — Đăng nhập, cấp quyền, khai báo mục tiêu và bài nghe đánh giá ban đầu.
 * Design: apps/docs/docs/04-modules/01-desktop/onboarding.md
 */
export { PermissionsStep } from './PermissionsStep';
export { OnboardingFlow } from './OnboardingFlow';
export {
  clearOnboarding,
  completeOnboarding,
  hasCompletedOnboarding,
  shouldShowOnboarding,
  type OnboardingMode,
} from './onboarding-storage';
