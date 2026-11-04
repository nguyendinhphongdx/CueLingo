import type { SessionController, SessionSnapshot } from './session-controller';

export interface TrayView {
  state: 'idle' | 'live' | 'warning';
  minutes: number;
  problem?: 'mic' | 'system';
}

/** What the menu-bar icon shows: states and whole minutes only, never anything from the meeting. */
export function trayViewOf(snapshot: SessionSnapshot, now: number): TrayView {
  // 'error' means the meeting is over; every other status (even the cloud drain after Stop) is live.
  if (snapshot.status === 'idle' || snapshot.status === 'error')
    return { state: 'idle', minutes: 0 };
  const elapsed =
    snapshot.startedAt === null ? 0 : Math.max(0, (snapshot.endedAt ?? now) - snapshot.startedAt);
  const minutes = Math.floor(elapsed / 60_000);
  if (snapshot.micFailed && snapshot.systemFailed) return { state: 'warning', minutes };
  if (snapshot.micFailed) return { state: 'warning', minutes, problem: 'mic' };
  if (snapshot.systemFailed) return { state: 'warning', minutes, problem: 'system' };
  return { state: 'live', minutes };
}

interface TrayBridge {
  setTray(view: TrayView): Promise<void>;
  onTrayStop(cb: () => void): Promise<() => void>;
}

const TICK_MS = 60_000;

/** Keeps the menu-bar icon in step with the controller; sends only changes, minute by minute. */
export function startTraySync(
  controller: Pick<SessionController, 'getSnapshot' | 'subscribe' | 'stop'>,
  native: TrayBridge,
  now: () => number = Date.now,
) {
  let last = '';
  const push = () => {
    const view = trayViewOf(controller.getSnapshot(), now());
    const key = JSON.stringify(view);
    if (key === last) return;
    last = key;
    // The icon is a convenience: a failed update must never break the meeting.
    void Promise.resolve()
      .then(() => native.setTray(view))
      .catch(() => {
        last = '';
      });
  };
  const unsubscribe = controller.subscribe(push);
  const timer = setInterval(push, TICK_MS);
  // Without a Tauri shell (plain browser, tests) the bridge is missing: the icon is simply absent.
  void Promise.resolve()
    .then(() => native.onTrayStop(() => void controller.stop()))
    .catch(() => undefined);
  push();
  return () => {
    unsubscribe();
    clearInterval(timer);
  };
}
