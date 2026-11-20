import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { getAllWindows } from '@tauri-apps/api/window';
import type { SystemNotification } from './notifications';

/** The system allows notifications, asking once if it has not been asked yet. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (await isPermissionGranted()) return true;
    return (await requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/** Whether notifications are allowed right now, without asking. */
export async function notificationPermissionGranted(): Promise<boolean> {
  try {
    return await isPermissionGranted();
  } catch {
    return false;
  }
}

export async function sendSystemNotification({ title, body }: SystemNotification) {
  if (!(await notificationPermissionGranted())) throw new Error('notifications_not_allowed');
  sendNotification({ title, body });
}

/** Any window of the app (main or overlay) has the keyboard focus. */
export async function appHasFocus(): Promise<boolean> {
  try {
    const windows = await getAllWindows();
    const states = await Promise.all(windows.map((window) => window.isFocused()));
    return states.some(Boolean);
  } catch {
    // Unknown: stay quiet rather than risk a notification over the window being used.
    return true;
  }
}
