import { beforeEach, describe, expect, it, vi } from 'vitest';

const { setAssistLevel } = vi.hoisted(() => ({ setAssistLevel: vi.fn() }));

vi.mock('../lib/native', () => ({ native: { setAssistLevel } }));

describe('AssistSettings', () => {
  beforeEach(() => setAssistLevel.mockReset());

  it('sends each selectable assist level to native', async () => {
    const { saveAssistLevel } = await import('./use-assist-settings');

    await saveAssistLevel(4);
    await saveAssistLevel(3);
    await saveAssistLevel(1);

    expect(setAssistLevel.mock.calls).toEqual([[4], [3], [1]]);
  });
});
