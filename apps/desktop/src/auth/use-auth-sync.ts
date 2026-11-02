import { useEffect } from 'react';
import { native } from '../lib/native';
import { useAuthStore } from './auth-store';

/**
 * Keeps a secondary window (the overlay) signed in. Each window is its own JS context, so the overlay
 * reads the token from the Keychain itself and again whenever the main window signs in or out.
 */
export function useAuthSync() {
  const set = useAuthStore((state) => state.set);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const load = () =>
      native
        .authTokenGet()
        .then((token) => {
          if (!disposed) set(token ? 'signedIn' : 'signedOut', token);
        })
        .catch(() => undefined);

    void load();
    void native
      .onAuthChanged(() => void load())
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [set]);
}
