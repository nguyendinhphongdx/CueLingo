import { useCallback, useRef, useState } from 'react';

/** Where the sidebar remembers which groups are folded. One key for the device, not tied to a user. */
export const COLLAPSED_GROUPS_KEY = 'cuelingo.sidebar.collapsed.v1';

const MAX_IDS = 50;

/** The folded group ids stored on this device; anything that is not a short list of strings counts as none. */
function read(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(COLLAPSED_GROUPS_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string').slice(0, MAX_IDS);
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    window.localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(ids));
  } catch {
    // Not remembered, but the groups still fold for this visit.
  }
}

/**
 * Folded state of the sidebar groups, remembered between visits. Ids of groups that are not on screen
 * (an admin group for a normal user, a group that was renamed) stay in storage and are simply ignored.
 */
export function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState<string[]>(read);
  const latest = useRef(collapsed);

  const set = useCallback((id: string, folded: boolean) => {
    const current = latest.current;
    if (current.includes(id) === folded) return;
    const next = folded ? [...current, id] : current.filter((x) => x !== id);
    latest.current = next;
    setCollapsed(next);
    write(next);
  }, []);

  const isCollapsed = useCallback((id: string) => collapsed.includes(id), [collapsed]);
  const toggle = useCallback((id: string) => set(id, !latest.current.includes(id)), [set]);
  const expand = useCallback((id: string) => set(id, false), [set]);

  return { isCollapsed, toggle, expand };
}
