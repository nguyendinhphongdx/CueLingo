import { afterEach, describe, expect, it, vi } from 'vitest';

const osPlatform = vi.hoisted(() => vi.fn<() => string>());
vi.mock('@tauri-apps/plugin-os', () => ({ platform: osPlatform, version: () => '10.0.0' }));

import {
  currentOs,
  deviceLabel,
  hasCalendar,
  isWindows,
  platformName,
  privacyPanes,
  shortcutLabel,
} from './platform';
import { PRIVACY_PANES } from './native';

afterEach(() => osPlatform.mockReset());

describe('current system', () => {
  it('is Windows only when the plugin says so', () => {
    osPlatform.mockReturnValue('windows');
    expect(currentOs()).toBe('windows');
    expect(isWindows()).toBe(true);
    osPlatform.mockReturnValue('macos');
    expect(currentOs()).toBe('macos');
    expect(isWindows()).toBe(false);
  });

  it('falls back to macOS outside Tauri, where the plugin throws', () => {
    osPlatform.mockImplementation(() => {
      throw new TypeError('no internals');
    });
    expect(currentOs()).toBe('macos');
  });

  it('names a platform id for a feedback report', () => {
    expect(platformName('macos')).toBe('macOS');
    expect(platformName('windows')).toBe('Windows');
    expect(platformName('linux')).toBe('linux');
  });
});

describe('shortcut labels', () => {
  it('writes Command and Shift as symbols on macOS and as Ctrl+Shift on Windows', () => {
    expect(shortcutLabel('L', 'macos')).toBe('⌘⇧L');
    expect(shortcutLabel('W', 'windows')).toBe('Ctrl+Shift+W');
    expect(shortcutLabel('S', 'windows')).toBe('Ctrl+Shift+S');
  });

  it('follows the current system when none is given', () => {
    osPlatform.mockReturnValue('windows');
    expect(shortcutLabel('L')).toBe('Ctrl+Shift+L');
  });
});

describe('settings pages', () => {
  it('opens the Microsoft pages on Windows and the Apple pages on macOS', () => {
    expect(privacyPanes('windows')).toEqual({
      microphone: 'ms-settings:privacy-microphone',
      systemAudio: 'ms-settings:sound',
    });
    expect(privacyPanes('macos').microphone).toContain('x-apple.systempreferences');
  });

  it('reads the system when used, not when the module loads', () => {
    osPlatform.mockReturnValue('windows');
    expect(PRIVACY_PANES.microphone).toBe('ms-settings:privacy-microphone');
    osPlatform.mockReturnValue('macos');
    expect(PRIVACY_PANES.microphone).toContain('Privacy_Microphone');
  });
});

describe('what differs by system', () => {
  it('has the calendar and labels the device per system', () => {
    expect(hasCalendar('macos')).toBe(true);
    expect(hasCalendar('windows')).toBe(false);
    expect(deviceLabel('macos')).toBe('CueLingo cho macOS');
    expect(deviceLabel('windows')).toBe('CueLingo cho Windows');
  });
});
