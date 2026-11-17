import { useEffect, useRef } from 'react';
import { native } from '../lib/native';

/** When the overlay asks for Cài đặt (a notice button), brings this window forward and opens that view. */
export function useOpenSettingsRequests(open: () => void) {
  const latest = useRef(open);
  latest.current = open;
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void native
      .onOpenSettings(() => {
        latest.current();
        void native.showMainWindow().catch(() => undefined);
      })
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
}
