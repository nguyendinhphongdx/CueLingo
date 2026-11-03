import { useState, type ReactNode } from 'react';

/** Nothing before the first open, then mounted for good and only hidden when closed. */
export function keepMountedMode(seen: boolean, open: boolean): 'unmounted' | 'hidden' | 'visible' {
  if (open) return 'visible';
  return seen ? 'hidden' : 'unmounted';
}

/** Keeps its children mounted once opened, so state inside (such as typed text) survives a close. */
export function KeepMounted({ open, children }: { open: boolean; children: ReactNode }) {
  const [seen, setSeen] = useState(open);
  if (open && !seen) setSeen(true);
  const mode = keepMountedMode(seen, open);
  if (mode === 'unmounted') return null;
  return <div hidden={mode === 'hidden'}>{children}</div>;
}
