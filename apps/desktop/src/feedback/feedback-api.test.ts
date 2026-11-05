import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn() }));

import { sendFeedback } from './feedback-api';

describe('sendFeedback (AC6)', () => {
  it('sends the typed text with the app version and OS, and nothing else', async () => {
    const send = vi.fn().mockResolvedValue({ id: 'x', createdAt: 'y' });
    await sendFeedback(
      { kind: 'bug', message: 'Caption trễ' },
      { feedback: { send } } as never,
      async () => ({ version: '0.1.1', os: 'macOS' }),
    );
    expect(send).toHaveBeenCalledWith({
      kind: 'bug',
      message: 'Caption trễ',
      client: 'desktop',
      appVersion: '0.1.1',
      os: 'macOS',
    });
    expect(Object.keys(send.mock.calls[0]![0]).sort()).toEqual(
      ['appVersion', 'client', 'kind', 'message', 'os'].sort(),
    );
  });

  it('lets a failure reach the form so it can say so', async () => {
    const send = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(
      sendFeedback({ kind: 'idea', message: 'x' }, { feedback: { send } } as never, async () => ({
        version: '1',
        os: 'macOS',
      })),
    ).rejects.toThrow('offline');
  });
});
