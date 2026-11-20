import { platform } from '@tauri-apps/plugin-os';

/** The two systems the desktop app runs on. Anything that is not Windows (also a plain browser in dev) is macOS. */
export type DesktopOs = 'macos' | 'windows';

/** The system this window runs on. `platform()` is sync in plugin-os v2 and throws outside Tauri. */
export function currentOs(): DesktopOs {
  try {
    return platform() === 'windows' ? 'windows' : 'macos';
  } catch {
    return 'macos';
  }
}

/** How a plugin-os platform id reads in a feedback report. */
export const platformName = (id: string): string =>
  id === 'macos' ? 'macOS' : id === 'windows' ? 'Windows' : id;

export const isWindows = (): boolean => currentOs() === 'windows';

/** The three global shortcuts (hotkeys.rs): the same letters on both systems, Command becomes Ctrl. */
export type ShortcutKey = 'L' | 'W' | 'S';

export function shortcutLabel(key: ShortcutKey, os: DesktopOs = currentOs()): string {
  return os === 'windows' ? `Ctrl+Shift+${key}` : `⌘⇧${key}`;
}

/** The settings pages the app can open. The calendar only exists on macOS (see `hasCalendar`). */
export interface PrivacyPanes {
  microphone: string;
  /** macOS: the system-audio permission. Windows has no such permission, so this is the Sound page (default output). */
  systemAudio: string;
  /** The system's page for this app's notifications. */
  notifications: string;
}

const MAC_PANES: PrivacyPanes = {
  microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  systemAudio: 'x-apple.systempreferences:com.apple.preference.security?Privacy_AudioCapture',
  notifications: 'x-apple.systempreferences:com.apple.Notifications-Settings.extension',
};

const WINDOWS_PANES: PrivacyPanes = {
  microphone: 'ms-settings:privacy-microphone',
  systemAudio: 'ms-settings:sound',
  notifications: 'ms-settings:notifications',
};

export const CALENDAR_PANE =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars';

export const privacyPanes = (os: DesktopOs = currentOs()): PrivacyPanes =>
  os === 'windows' ? WINDOWS_PANES : MAC_PANES;

/** Calendar suggestions read EventKit, so they exist on macOS only (plan G5). */
export const hasCalendar = (os: DesktopOs = currentOs()): boolean => os === 'macos';

/** The name of this device as the server lists it under the account. */
export const deviceLabel = (os: DesktopOs = currentOs()): string =>
  os === 'windows' ? 'CueLingo cho Windows' : 'CueLingo cho macOS';
