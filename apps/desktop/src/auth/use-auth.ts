import { useCallback, useEffect, useState } from 'react';
import { native } from '../lib/native';
import { exchangeCode, revokeThisDevice, signInUrl } from './auth-api';
import { useAuthStore } from './auth-store';

export type SignInPhase = 'idle' | 'waiting' | 'exchanging' | 'failed';

/**
 * Loads the saved token at start, finishes sign-in when the browser hands back a code, and signs out.
 * Mount it once, at the top of the app.
 */
export function useAuth() {
  const status = useAuthStore((state) => state.status);
  const token = useAuthStore((state) => state.token);
  const set = useAuthStore((state) => state.set);
  const [phase, setPhase] = useState<SignInPhase>('idle');

  useEffect(() => {
    let cancelled = false;
    native
      .authTokenGet()
      .then((saved) => {
        if (!cancelled) set(saved ? 'signedIn' : 'signedOut', saved);
      })
      .catch(() => {
        if (!cancelled) set('signedOut', null);
      });
    return () => {
      cancelled = true;
    };
  }, [set]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void native
      .onAuthCode(async (code) => {
        setPhase('exchanging');
        try {
          const newToken = await exchangeCode(code);
          await native.authTokenSet(newToken);
          set('signedIn', newToken);
          void native.publishAuthChanged();
          setPhase('idle');
        } catch {
          setPhase('failed');
        }
      })
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [set]);

  const signIn = useCallback(async () => {
    setPhase('waiting');
    try {
      await native.openUrl(signInUrl());
    } catch {
      setPhase('failed');
    }
  }, []);

  const signOut = useCallback(async () => {
    if (token) await revokeThisDevice(token);
    await native.authTokenClear().catch(() => undefined);
    set('signedOut', null);
    void native.publishAuthChanged();
    setPhase('idle');
  }, [set, token]);

  return { status, token, phase, signIn, signOut };
}
