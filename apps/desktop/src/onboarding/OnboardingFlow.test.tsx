import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextOnboardingStep, OnboardingFlow, saveSelectedAssistLevel } from './OnboardingFlow';
import {
  clearOnboarding,
  completeOnboarding,
  hasCompletedOnboarding,
  onboardingKey,
  shouldShowOnboarding,
} from './onboarding-storage';

describe('onboarding storage', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
  };

  beforeEach(() => {
    values.clear();
    vi.clearAllMocks();
  });

  it('stores completion separately for each signed-in person', () => {
    expect(hasCompletedOnboarding('user-a', storage)).toBe(false);

    completeOnboarding('user-a', storage);

    expect(storage.setItem).toHaveBeenCalledWith(onboardingKey('user-a'), 'true');
    expect(hasCompletedOnboarding('user-a', storage)).toBe(true);
    expect(hasCompletedOnboarding('user-b', storage)).toBe(false);
  });

  it('clears the flag when the person chooses to review the guide', () => {
    completeOnboarding('dev', storage);
    clearOnboarding('dev', storage);

    expect(storage.removeItem).toHaveBeenCalledWith('cuelingo.onboarded.dev');
    expect(hasCompletedOnboarding('dev', storage)).toBe(false);
  });

  it('opens automatically only without a flag, and can be reopened explicitly', () => {
    expect(shouldShowOnboarding('auto', 'user-a', storage)).toBe(true);
    completeOnboarding('user-a', storage);
    expect(shouldShowOnboarding('auto', 'user-a', storage)).toBe(false);
    expect(shouldShowOnboarding('open', 'user-a', storage)).toBe(true);
    expect(shouldShowOnboarding('complete', 'user-a', storage)).toBe(false);
  });

  it('does not throw when storage is blocked', () => {
    const blocked = {
      getItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      setItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      removeItem: vi.fn(() => {
        throw new Error('blocked');
      }),
    };

    expect(hasCompletedOnboarding('dev', blocked)).toBe(false);
    expect(() => completeOnboarding('dev', blocked)).not.toThrow();
    expect(() => clearOnboarding('dev', blocked)).not.toThrow();
  });
});

describe('OnboardingFlow', () => {
  it('lets the permission step continue without requiring a permission', () => {
    expect(nextOnboardingStep(1)).toBe(2);
  });

  it('starts with the welcome step and marks it as current', () => {
    const markup = renderToStaticMarkup(<OnboardingFlow onFinish={() => undefined} />);

    expect(markup).toContain('Theo kịp cuộc họp bằng tiếng Anh');
    expect(markup).toContain('aria-current="step"');
    expect(markup).toContain('Bắt đầu');
  });

  it('shows two real sample caption blocks and the overlay action', () => {
    const markup = renderToStaticMarkup(
      <OnboardingFlow initialStep={2} onFinish={() => undefined} />,
    );

    expect(markup.match(/data-slot="caption-line"/g)).toHaveLength(2);
    expect(markup).toContain('Hãy cùng xem lại kế hoạch cho tuần này.');
    expect(markup).toContain('Hiện overlay thử');
    expect(markup).toContain('⌘⇧L');
  });

  it('offers every selectable assist level on the last step', () => {
    const markup = renderToStaticMarkup(
      <OnboardingFlow initialStep={3} onFinish={() => undefined} />,
    );

    expect(markup).toContain('4 · Đầy đủ');
    expect(markup).toContain('3 · Gợi ý');
    expect(markup).toContain('1 · Tối thiểu');
    expect(markup).toContain('0 · Ẩn');
    expect(markup).toContain('Vào CueLingo');
  });

  it.each(['4', '3', '1', '0'])('saves assist level %s when selected', async (value) => {
    const save = vi.fn().mockResolvedValue(undefined);

    await saveSelectedAssistLevel(value, save);

    expect(save).toHaveBeenCalledWith(Number(value));
  });
});
