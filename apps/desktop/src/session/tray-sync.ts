import type { SessionController, SessionSnapshot } from './session-controller';

/** `problem` is `both` when mic and system audio failed (the menu bar then says it without naming one). */
export interface TrayView {
  active: boolean;
  minutes: number;
  problem?: 'mic' | 'system' | 'both';
}

/**
 * What this window tells the menu bar. It does not decide idle or live: the native side knows
 * whether capture runs. This adds the cloud drain after Stop, the minutes and failed streams, and
 * never anything from the meeting.
 */
export function trayViewOf(snapshot: SessionSnapshot, now: number): TrayView {
  // 'error' reports nothing: capture may still run then, and the native side keeps the icon live.
  if (snapshot.status === 'idle' || snapshot.status === 'error')
    return { active: false, minutes: 0 };
  const elapsed =
    snapshot.startedAt === null ? 0 : Math.max(0, (snapshot.endedAt ?? now) - snapshot.startedAt);
  const minutes = Math.floor(elapsed / 60_000);
  if (snapshot.micFailed && snapshot.systemFailed)
    return { active: true, minutes, problem: 'both' };
  if (snapshot.micFailed) return { active: true, minutes, problem: 'mic' };
  if (snapshot.systemFailed) return { active: true, minutes, problem: 'system' };
  return { active: true, minutes };
}

interface TrayBridge {
  trayReport(view: TrayView): Promise<void>;
  onTrayStop(cb: () => void): Promise<() => void>;
}

/** The minute changes at the meeting's own mark, so a short tick keeps the icon within seconds of it. */
const TICK_MS = 15_000;
const RETRY_MS = 2_000;

/** Keeps the menu bar in step with the controller; sends only changes. */
export function startTraySync(
  controller: Pick<SessionController, 'getSnapshot' | 'subscribe' | 'stop'>,
  native: TrayBridge,
  now: () => number = Date.now,
) {
  let last = '';
  let retry: ReturnType<typeof setTimeout> | undefined;
  const push = () => {
    const view = trayViewOf(controller.getSnapshot(), now());
    const key = JSON.stringify(view);
    if (key === last) return;
    last = key;
    // The icon is a convenience: a failed update must never break the meeting, but is tried again.
    void Promise.resolve()
      .then(() => native.trayReport(view))
      .catch(() => {
        last = '';
        clearTimeout(retry);
        retry = setTimeout(push, RETRY_MS);
      });
  };
  const unsubscribe = controller.subscribe(push);
  const timer = setInterval(push, TICK_MS);
  // Without a Tauri shell (plain browser, tests) the bridge is missing: the icon is simply absent.
  void Promise.resolve()
    .then(() =>
      native.onTrayStop(() => {
        // Stop is off in the panel while a meeting is still starting; the menu follows the same rule.
        if (controller.getSnapshot().status !== 'connecting') void controller.stop();
      }),
    )
    .catch(() => undefined);
  push();
  return () => {
    unsubscribe();
    clearInterval(timer);
    clearTimeout(retry);
  };
}
