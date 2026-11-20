import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useRef } from 'react';
import { useSession } from '../session';
import { useDebriefBrief } from '../session/use-debrief-brief';
import { appHasFocus, sendSystemNotification } from './native-gate';
import { createNotifier, readNotificationsEnabled, type NotificationTarget } from './notifications';

/**
 * Tells the person, while the app is in the background, that the debrief is ready or that capture
 * broke. When they come back to the main window, `onOpen` takes them to where the message pointed.
 */
export function useSystemNotifications(onOpen: (target: NotificationTarget) => void) {
  const notifier = useRef(
    createNotifier({
      enabled: readNotificationsEnabled,
      appFocused: appHasFocus,
      send: sendSystemNotification,
    }),
  ).current;
  const session = useSession();
  const running = session.status !== 'idle' && session.status !== 'error';
  const finishedId =
    running || session.completedSegmentCount === 0 ? null : session.completedSessionId;
  const brief = useDebriefBrief(finishedId);
  const meetingKey = String(session.startedAt ?? 'none');

  useEffect(() => {
    if (session.micFailed) void notifier.notify('mic', meetingKey);
  }, [session.micFailed, meetingKey, notifier]);

  useEffect(() => {
    if (session.systemFailed) void notifier.notify('system', meetingKey);
  }, [session.systemFailed, meetingKey, notifier]);

  useEffect(() => {
    if (finishedId && brief.status === 'ready') void notifier.notify('debrief', finishedId);
  }, [finishedId, brief.status, notifier]);

  const open = useRef(onOpen);
  open.current = onOpen;
  useEffect(() => {
    let off: (() => void) | undefined;
    let cancelled = false;
    getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (!focused) return;
        const target = notifier.takeTarget();
        if (target) open.current(target);
      })
      .then((unlisten) => (cancelled ? unlisten() : (off = unlisten)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
      off?.();
    };
  }, [notifier]);
}
