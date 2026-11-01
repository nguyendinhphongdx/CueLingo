import { useCallback, useState } from 'react';

/** Shared state for AppFrame's compact navigation; native buttons provide keyboard behavior. */
export function useMobileNavigation() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((current) => !current), []);

  return { open, close, toggle };
}
