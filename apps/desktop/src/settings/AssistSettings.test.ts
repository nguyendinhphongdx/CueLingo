import { beforeEach, describe, expect, it, vi } from 'vitest';

const { setAssistLevel, publishSettings } = vi.hoisted(() => ({
  setAssistLevel: vi.fn(),
  publishSettings: vi.fn(),
}));

vi.mock('../lib/native', () => ({ native: { setAssistLevel, publishSettings } }));

describe('AssistSettings', () => {
  beforeEach(() => {
    setAssistLevel.mockReset().mockResolvedValue(undefined);
    publishSettings.mockReset().mockResolvedValue(undefined);
  });

  it('sends each selectable assist level to native', async () => {
    const { saveAssistLevel } = await import('./use-assist-settings');

    await saveAssistLevel(4);
    await saveAssistLevel(3);
    await saveAssistLevel(1);
    await saveAssistLevel(0);

    expect(setAssistLevel.mock.calls).toEqual([[4], [3], [1], [0]]);
    expect(publishSettings.mock.calls).toEqual([
      [{ assistLevel: 4 }],
      [{ assistLevel: 3 }],
      [{ assistLevel: 1 }],
      [{ assistLevel: 0 }],
    ]);
  });
});
