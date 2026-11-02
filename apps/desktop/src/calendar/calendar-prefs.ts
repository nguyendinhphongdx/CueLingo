const ENABLED_KEY = 'cuelingo.calendar-hints';
const DISMISSED_KEY = 'cuelingo.calendar-dismissed';

/** Calendar suggestions are opt-in: nothing reads the calendar until the person turns them on. */
export function readCalendarEnabled(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_KEY) === 'on';
  } catch {
    return false;
  }
}

export function writeCalendarEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(ENABLED_KEY, enabled ? 'on' : 'off');
  } catch {
    // Not remembered; the choice applies until the app closes.
  }
}

export function readDismissed(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

export function writeDismissed(keys: Set<string>) {
  try {
    // Only recent ones matter; keep the list from growing for ever.
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...keys].slice(-50)));
  } catch {
    // Not remembered.
  }
}
