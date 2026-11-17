import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  advanceProgress,
  ONBOARDING_STEPS,
  pendingSteps,
  readProgress,
  writeProgress,
} from './onboarding-storage';
import {
  footerFor,
  MODEL_STEP,
  ModelStepView,
  nextOnboardingStep,
  OnboardingFlow,
  saveSelectedAssistLevel,
} from './OnboardingFlow';
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

const client = new QueryClient();
const renderFlow = (step: number) =>
  renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <OnboardingFlow initialStep={step} onFinish={() => undefined} />
    </QueryClientProvider>,
  );

describe('OnboardingFlow', () => {
  it('lets the permission step continue without requiring a permission', () => {
    expect(nextOnboardingStep(1)).toBe(2);
  });

  it('starts with the welcome step and marks it as current', () => {
    const markup = renderFlow(0);

    expect(markup).toContain('Theo kịp cuộc họp bằng tiếng Anh');
    expect(markup).toContain('aria-current="step"');
    expect(markup).toContain('Bắt đầu');
  });

  it('shows two real sample caption blocks and the overlay action', () => {
    const markup = renderFlow(5);

    expect(markup.match(/data-slot="caption-line"/g)).toHaveLength(2);
    expect(markup).toContain('Hãy cùng xem lại kế hoạch cho tuần này.');
    expect(markup).toContain('Hiện overlay thử');
    expect(markup).toContain('⌘⇧L');
    expect(markup).toContain('Vào CueLingo');
  });

  it('has the six steps and every one can be left for later', () => {
    expect(ONBOARDING_STEPS.map((step) => step.id)).toEqual([
      'welcome',
      'permissions',
      'model',
      'profile',
      'listening',
      'shortcuts',
    ]);
    for (let step = 0; step < 6; step += 1) {
      const markup = renderFlow(step);
      expect(markup).toContain('Thoát, làm tiếp sau');
      expect(markup).toContain(`Bước ${step + 1} trên 6`);
      // Visible text, not only the aria-label of the nav.
      expect(markup).toMatch(
        new RegExp(`<p[^>]*>Bước (<!-- -->)?${step + 1}(<!-- -->)? (<!-- -->)?trên`),
      );
    }
  });

  it('offers to skip the steps that can wait, but not the welcome or the last', () => {
    const at = renderFlow;
    expect(at(1)).toContain('Để sau');
    expect(at(4)).toContain('Để sau');
    expect(at(0)).not.toContain('Để sau');
    expect(at(5)).not.toContain('Để sau');
  });

  it('puts the exit in a corner button and keeps the footer to back, skip and the main button', () => {
    const markup = renderFlow(1);
    expect(markup).toMatch(/<button[^>]*aria-label="Thoát, làm tiếp sau"/);
    // The exit is no longer a text button in the footer.
    expect(markup).not.toMatch(/<button[^>]*>Thoát, làm tiếp sau<\/button>/);
    expect(markup).toContain('Quay lại');
  });

  it('keeps the model step first in line with the step the footer guards', () => {
    expect(ONBOARDING_STEPS[MODEL_STEP]?.id).toBe('model');
  });

  it('blocks the model step until the model is checked and in place', () => {
    // The first answer has not come yet in a static render: the main button is locked, with no skip.
    const markup = renderFlow(MODEL_STEP);
    expect(markup).toContain('Đang kiểm tra');
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>Tiếp tục<\/button>/);
    expect(markup).not.toContain('Bỏ qua, tải sau');
  });

  it('offers every selectable assist level on the last step', () => {
    const markup = renderFlow(3);

    expect(markup).toContain('4 · Đầy đủ');
    expect(markup).toContain('3 · Gợi ý');
    expect(markup).toContain('1 · Tối thiểu');
    expect(markup).toContain('0 · Ẩn');
  });

  it.each(['4', '3', '1', '0'])('saves assist level %s when selected', async (value) => {
    const save = vi.fn().mockResolvedValue(undefined);

    await saveSelectedAssistLevel(value, save);

    expect(save).toHaveBeenCalledWith(Number(value));
  });
});

describe('onboarding progress', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
  beforeEach(() => values.clear());

  it('remembers where the person stopped, per person', () => {
    expect(readProgress('a', storage)).toBeNull();
    writeProgress('a', advanceProgress(null, 0, 1), storage);
    writeProgress('a', advanceProgress(readProgress('a', storage), 1, 2), storage);
    expect(readProgress('a', storage)).toEqual({ step: 2, done: [0, 1] });
    expect(readProgress('b', storage)).toBeNull();
  });

  it('turns steps that were skipped or not reached into cards, never the welcome', () => {
    expect(pendingSteps(null)).toEqual([]);
    expect(pendingSteps({ step: 5, done: [0, 1, 3, 5] })).toEqual([2, 4]);
    expect(pendingSteps({ step: 5, done: [0, 1, 2, 3, 4, 5] })).toEqual([]);
  });

  it('survives damaged saved data', () => {
    values.set('cuelingo.onboarding-progress.a', '{"step":99,"done":[1,"x",-4,2,2]}');
    expect(readProgress('a', storage)).toEqual({ step: 5, done: [1, 2] });
    values.set('cuelingo.onboarding-progress.a', 'not json');
    expect(readProgress('a', storage)).toBeNull();
  });
});

describe('footerFor', () => {
  const missing = { kind: 'missing', sizeBytes: 661_288_526 } as const;

  it('locks the model step and drops its skip until the model is ready', () => {
    for (const view of [
      missing,
      { kind: 'checking' },
      { kind: 'downloading', sizeBytes: 1, progress: 0.3 },
      { kind: 'error', sizeBytes: 1, message: 'x' },
    ] as const) {
      expect(footerFor(MODEL_STEP, view)).toEqual({
        forward: 'Tiếp tục',
        skip: null,
        blocked: true,
      });
    }
  });

  it('opens the model step at once when the model is already there', () => {
    expect(footerFor(MODEL_STEP, { kind: 'ready', sizeBytes: 1 })).toEqual({
      forward: 'Tiếp tục',
      skip: null,
      blocked: false,
    });
  });

  it('keeps the old flow when the app cannot manage models: skip stays, nothing is locked', () => {
    expect(footerFor(MODEL_STEP, null)).toEqual({
      forward: 'Tiếp tục',
      skip: 'Bỏ qua, tải sau',
      blocked: false,
    });
  });

  it('never locks the other steps', () => {
    for (const step of [0, 1, 3, 4, 5]) {
      expect(footerFor(step, missing).blocked).toBe(false);
    }
    expect(footerFor(1, missing).skip).toBe('Để sau');
    expect(footerFor(0, missing).skip).toBeNull();
  });
});

describe('ModelStepView', () => {
  const html = (view: Parameters<typeof ModelStepView>[0]['view']) =>
    renderToStaticMarkup(<ModelStepView view={view} onDownload={() => undefined} />);

  it('offers the download with the size when the model is missing', () => {
    const out = html({ kind: 'missing', sizeBytes: 661_288_526 });
    expect(out).toContain('Tải mô hình ngay');
    expect(out).toContain('631 MB');
    expect(out).toContain('Cần tải xong mô hình để tiếp tục.');
  });

  it('says the model is there and no download is needed', () => {
    const out = html({ kind: 'ready', sizeBytes: 661_288_526 });
    expect(out).toContain('Đã sẵn sàng');
    expect(out).toContain('Bạn có thể tiếp tục.');
    expect(out).not.toContain('Tải mô hình ngay');
  });

  it('shows the progress while downloading', () => {
    const out = html({ kind: 'downloading', sizeBytes: 661_288_526, progress: 0.5 });
    expect(out).toContain('role="progressbar"');
    expect(out).toContain('50%');
  });
});
