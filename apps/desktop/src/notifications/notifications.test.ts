// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  createNotifier,
  NOTIFICATIONS,
  readNotificationsEnabled,
  TARGET_TTL_MS,
  writeNotificationsEnabled,
} from './notifications';

function setup(overrides: { enabled?: boolean; focused?: boolean; fail?: boolean } = {}) {
  const sent: { title: string; body: string }[] = [];
  let time = 1_000;
  const state = { enabled: overrides.enabled ?? true, focused: overrides.focused ?? false };
  const notifier = createNotifier({
    enabled: () => state.enabled,
    appFocused: async () => state.focused,
    send: async (notification) => {
      if (overrides.fail) throw new Error('boom');
      sent.push(notification);
    },
    now: () => time,
  });
  return { notifier, sent, state, advance: (ms: number) => (time += ms) };
}

describe('createNotifier', () => {
  it('shows a notification when the app is in the background', async () => {
    const { notifier, sent } = setup();
    expect(await notifier.notify('debrief', 'm1')).toBe(true);
    expect(sent).toEqual([{ title: 'CueLingo', body: 'Debrief đã sẵn sàng' }]);
  });

  it('stays quiet while a window of the app is in front', async () => {
    const { notifier, sent } = setup({ focused: true });
    expect(await notifier.notify('mic', 'm1')).toBe(false);
    expect(sent).toEqual([]);
  });

  it('stays quiet when the switch is off', async () => {
    const { notifier, sent } = setup({ enabled: false });
    expect(await notifier.notify('debrief', 'm1')).toBe(false);
    expect(sent).toEqual([]);
  });

  it('shows each event once, but the same problem in a new meeting again', async () => {
    const { notifier, sent } = setup();
    await notifier.notify('mic', 'm1');
    await notifier.notify('mic', 'm1');
    await notifier.notify('mic', 'm2');
    expect(sent).toHaveLength(2);
  });

  it('does not use up an event while it was suppressed', async () => {
    const { notifier, sent, state } = setup({ focused: true });
    await notifier.notify('debrief', 'm1');
    state.focused = false;
    expect(await notifier.notify('debrief', 'm1')).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it('survives a notification that cannot be shown', async () => {
    const { notifier } = setup({ fail: true });
    await expect(notifier.notify('debrief', 'm1')).resolves.toBe(false);
    expect(notifier.takeTarget()).toBeNull();
  });

  it('remembers where to go for two minutes, once', async () => {
    const { notifier, advance } = setup();
    await notifier.notify('debrief', 'm1');
    advance(TARGET_TTL_MS - 1);
    expect(notifier.takeTarget()).toBe('meetings');
    expect(notifier.takeTarget()).toBeNull();

    await notifier.notify('mic', 'm2');
    advance(TARGET_TTL_MS + 1);
    expect(notifier.takeTarget()).toBeNull();
  });

  it('sends capture problems to Cài đặt', async () => {
    const { notifier } = setup();
    await notifier.notify('system', 'm1');
    expect(notifier.takeTarget()).toBe('settings');
  });

  it('only ever sends the fixed texts, whatever the key is', async () => {
    const { notifier, sent } = setup();
    await notifier.notify('debrief', 'Họp lương với Nguyễn Văn A');
    expect(sent[0]).toEqual({
      title: NOTIFICATIONS.debrief.title,
      body: NOTIFICATIONS.debrief.body,
    });
    expect(JSON.stringify(sent)).not.toContain('Nguyễn');
  });
});

describe('the switch', () => {
  it('is on by default and remembers a change', () => {
    window.localStorage.clear();
    expect(readNotificationsEnabled()).toBe(true);
    writeNotificationsEnabled(false);
    expect(readNotificationsEnabled()).toBe(false);
    writeNotificationsEnabled(true);
    expect(readNotificationsEnabled()).toBe(true);
  });

  it('stays on when storage is blocked', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readNotificationsEnabled()).toBe(true);
    spy.mockRestore();
  });
});
