import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ModelStep } from './ModelStep';
import { OnboardingFlow } from './OnboardingFlow';
import { modelActionLabel } from '../settings/ModelSetting';
import { describePrewarmError } from '../settings/use-speech-model';

vi.mock('../lib/native', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  native: {
    onAudioModel: vi.fn(() => new Promise(() => undefined)),
    appInfo: vi.fn(async () => ({ version: '0.1.6', os: 'macOS' })),
    speechModelStatus: vi.fn(async () => 'missing'),
    prewarmSpeech: vi.fn(async () => undefined),
  },
}));

const render = (node: React.ReactNode) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>,
  );

describe('ModelStep', () => {
  it('names the model, tells the size and lets the person skip', () => {
    const html = render(<ModelStep onSkip={() => undefined} />);
    expect(html).toContain('Mô hình nhận dạng');
    expect(html).toContain('Nhận dạng tiếng anh');
    expect(html).toContain('Bỏ qua');
  });

  it('is the third of the onboarding steps', () => {
    const html = render(<OnboardingFlow initialStep={2} onFinish={() => undefined} />);
    expect(html).toContain('3/6');
    expect(html).toContain('Tiếp tục');
    expect(html).toContain('Mô hình nhận dạng');
  });
});

describe('model actions', () => {
  it('picks the button that fits each state', () => {
    expect(modelActionLabel('missing')).toBe('Tải về');
    expect(modelActionLabel('cached')).toBe('Chuẩn bị');
    expect(modelActionLabel('error')).toBe('Thử lại');
    expect(modelActionLabel('downloading')).toBeUndefined();
    expect(modelActionLabel('ready')).toBeUndefined();
  });

  it('explains a refused start without leaking internals', () => {
    expect(describePrewarmError(new Error('session_already_running'))).toContain('cuộc họp');
    expect(describePrewarmError(new Error('audio_sidecar_failed: x'))).toContain('kết nối mạng');
  });
});
