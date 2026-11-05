import type { LearningEvent } from '@cuelingo/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createActivation } from './activation';

class MemoryStore {
  data = new Map<string, string>();
  getItem = (key: string) => this.data.get(key) ?? null;
  setItem = (key: string, value: string) => void this.data.set(key, value);
}

describe('activation telemetry (AC7)', () => {
  let store: MemoryStore;
  let sent: LearningEvent[];
  let record: ReturnType<typeof vi.fn<(event: LearningEvent) => Promise<void>>>;
  let clock: Date;

  beforeEach(() => {
    store = new MemoryStore();
    sent = [];
    clock = new Date('2026-11-10T08:00:00.000Z');
    record = vi.fn(async (event: LearningEvent) => void sent.push(event));
    vi.stubGlobal('localStorage', { removeItem: (key: string) => store.data.delete(key) });
  });
  const make = () => createActivation({ store, record, now: () => clock });

  it('keeps the first launch until someone signs in, then sends it once with that time', async () => {
    const activation = make();
    activation.recordLaunch();
    clock = new Date('2026-11-10T09:00:00.000Z');
    activation.recordLaunch();
    expect(record).not.toHaveBeenCalled();

    await activation.signedIn('user-a');
    await activation.signedIn('user-a');
    expect(sent).toEqual([{ type: 'app_installed_first_run', at: '2026-11-10T08:00:00.000Z' }]);
  });

  it('survives a restart: a second instance does not send again', async () => {
    const first = make();
    first.recordLaunch();
    await first.signedIn('user-a');
    const second = make();
    second.recordLaunch();
    await second.signedIn('user-a');
    expect(sent).toHaveLength(1);
  });

  it('tries again next time when sending failed', async () => {
    const activation = make();
    activation.recordLaunch();
    record.mockRejectedValueOnce(new Error('offline'));
    await activation.signedIn('user-a');
    await activation.signedIn('user-a');
    expect(record).toHaveBeenCalledTimes(2);
    expect(sent).toHaveLength(1);
  });

  it('sends the first caption once per person, with the meeting id and no text', async () => {
    const activation = make();
    await activation.signedIn('user-a');
    await Promise.all([activation.captionShown('s1'), activation.captionShown('s1')]);
    await activation.captionShown('s2');
    const captions = sent.filter((e) => e.type === 'first_caption_shown');
    expect(captions).toEqual([
      { type: 'first_caption_shown', sessionId: 's1', at: '2026-11-10T08:00:00.000Z' },
    ]);
    expect(JSON.stringify(captions)).not.toMatch(/text/);
  });

  it('does nothing for captions while nobody is signed in', async () => {
    const activation = make();
    await activation.captionShown('s1');
    expect(record).not.toHaveBeenCalled();
  });

  it('keeps people apart on a shared Mac', async () => {
    const activation = make();
    activation.recordLaunch();
    await activation.signedIn('user-a');
    await activation.signedIn('user-b');
    expect(sent.filter((e) => e.type === 'app_installed_first_run')).toHaveLength(2);
  });
});
