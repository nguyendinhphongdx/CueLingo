import { useCallback, useEffect, useState } from 'react';
import { native, type NoticeEvent } from '../lib/native';

/** Messages the main window sends while a meeting runs (allowance low or used up); the person can dismiss each. */
export function useNotices(enabled = true) {
  const [notices, setNotices] = useState<NoticeEvent[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void native
      .onNotice((notice) =>
        setNotices((current) =>
          current.some((item) => item.id === notice.id) ? current : [...current, notice],
        ),
      )
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [enabled]);

  const dismiss = useCallback(
    (id: string) => setNotices((current) => current.filter((item) => item.id !== id)),
    [],
  );
  return { notices, dismiss };
}
