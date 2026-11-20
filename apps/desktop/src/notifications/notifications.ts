/**
 * System notifications for a CueLingo that runs in the background. Pure logic: whether to show one, the fixed
 * texts, no repeats, and where the next focus should go. The plugin call itself is in `native-gate.ts`.
 */

const ENABLED_KEY = 'cuelingo.notifications';

/** On unless the person turned it off. */
export function readNotificationsEnabled(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function writeNotificationsEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(ENABLED_KEY, enabled ? 'on' : 'off');
  } catch {
    // Not remembered; the choice applies until the app closes.
  }
}

export type NotificationKind = 'debrief' | 'mic' | 'system';
/** Where the app goes when the person comes back to it after a notification. */
export type NotificationTarget = 'meetings' | 'settings';

export interface SystemNotification {
  title: string;
  body: string;
}

/**
 * The only texts that ever leave the app as a notification. Fixed on purpose: nothing from the meeting (no
 * transcript, names, titles or terms) can reach the operating system's notification centre.
 */
export const NOTIFICATIONS: Record<
  NotificationKind,
  SystemNotification & { target: NotificationTarget }
> = {
  debrief: { title: 'CueLingo', body: 'Debrief đã sẵn sàng', target: 'meetings' },
  mic: {
    title: 'CueLingo',
    body: 'Không dùng được micro nên CueLingo chưa nghe được giọng bạn',
    target: 'settings',
  },
  system: {
    title: 'CueLingo',
    body: 'Không thu được âm thanh hệ thống của cuộc họp',
    target: 'settings',
  },
};

/** After this long a notification no longer decides where the app goes. */
export const TARGET_TTL_MS = 2 * 60_000;

export interface NotifierDeps {
  enabled(): boolean;
  /** Any window of the app is in front (the person sees the in-app message already). */
  appFocused(): Promise<boolean>;
  send(notification: SystemNotification): Promise<void>;
  now?(): number;
}

export interface Notifier {
  /** `key` names the event (for example the meeting's id) so the same one is never shown twice. */
  notify(kind: NotificationKind, key: string): Promise<boolean>;
  /** The target of the newest notification if it is still fresh; asking clears it. */
  takeTarget(): NotificationTarget | null;
}

export function createNotifier(deps: NotifierDeps): Notifier {
  const now = deps.now ?? Date.now;
  const shown = new Set<string>();
  let pending: { target: NotificationTarget; at: number } | null = null;

  return {
    async notify(kind, key) {
      const id = `${kind}:${key}`;
      if (shown.has(id) || !deps.enabled()) return false;
      if (await deps.appFocused()) return false;
      shown.add(id);
      const { title, body, target } = NOTIFICATIONS[kind];
      try {
        await deps.send({ title, body });
      } catch {
        // A notification that cannot be shown must never break the meeting.
        return false;
      }
      pending = { target, at: now() };
      return true;
    },
    takeTarget() {
      const found = pending;
      pending = null;
      return found && now() - found.at <= TARGET_TTL_MS ? found.target : null;
    },
  };
}
