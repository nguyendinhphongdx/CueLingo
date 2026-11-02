import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { authClient } from '../../lib/auth-client';

/** `/login?app=1` is how the desktop app sends people here: after signing in they go to the hand-off page. */
export const APP_SIGN_IN_PATH = '/app-auth';
/** Where the Google popup lands when it is done; that page tells this one and closes itself. */
export const POPUP_DONE_PATH = '/auth-popup-done';
export const POPUP_MESSAGE = 'cuelingo-google-done';
export const POPUP_CHANNEL = 'cuelingo-auth';
/** How long to wait for someone to finish in the Google window before letting them try again. */
const POPUP_TIMEOUT_MS = 3 * 60 * 1000;

const fromDesktop = () => new URLSearchParams(window.location.search).get('app') === '1';
const redirectTarget = () =>
  `${window.location.origin}${fromDesktop() ? APP_SIGN_IN_PATH : '/glossary'}`;

/** A centred window for Google's account chooser. Must run inside the click so browsers allow it. */
function openPopup(): Window | null {
  const width = 480;
  const height = 640;
  const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
  return window.open(
    'about:blank',
    'cuelingo-google',
    `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
  );
}

/**
 * Sign-in actions for the login screen. UI components never touch authClient directly.
 * Google opens in a popup so the page behind it keeps its place; if the browser blocks popups it
 * falls back to a normal redirect.
 */
export function useLogin() {
  const [popupOpen, setPopupOpen] = useState(false);
  const popup = useRef<Window | null>(null);

  const magicLink = useMutation({
    mutationFn: async (email: string) => {
      const result = await authClient.signIn.magicLink({ email, callbackURL: redirectTarget() });
      if (result.error) throw new Error('Không gửi được liên kết đăng nhập, vui lòng thử lại');
    },
  });

  const google = useMutation({
    mutationFn: async () => {
      const opened = openPopup();
      if (!opened) {
        const result = await authClient.signIn.social({
          provider: 'google',
          callbackURL: redirectTarget(),
        });
        if (result.error) throw new Error('Không đăng nhập được bằng Google, vui lòng thử lại');
        return;
      }

      popup.current = opened;
      setPopupOpen(true);
      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL: `${window.location.origin}${POPUP_DONE_PATH}`,
        disableRedirect: true,
      });
      const url = result.data?.url;
      if (result.error || !url) {
        opened.close();
        setPopupOpen(false);
        throw new Error('Không đăng nhập được bằng Google, vui lòng thử lại');
      }
      opened.location.href = url;
    },
  });

  // Google's pages cut the link between a popup and its opener, so `postMessage` and `popup.closed` are
  // unreliable. Listen on a same-origin channel and also watch for the session to appear.
  useEffect(() => {
    if (!popupOpen) return;
    let finished = false;
    const finish = (ok: boolean) => {
      if (finished) return;
      finished = true;
      popup.current?.close();
      setPopupOpen(false);
      if (ok) window.location.href = redirectTarget();
    };
    const channel =
      typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(POPUP_CHANNEL);
    channel?.addEventListener('message', (event) => {
      if (event.data?.type === POPUP_MESSAGE) finish(Boolean(event.data.ok));
    });
    const watcher = window.setInterval(async () => {
      const { data } = await authClient.getSession().catch(() => ({ data: null }));
      if (data) finish(true);
    }, 1500);
    const giveUp = window.setTimeout(() => finish(false), POPUP_TIMEOUT_MS);
    return () => {
      finished = true;
      channel?.close();
      window.clearInterval(watcher);
      window.clearTimeout(giveUp);
    };
  }, [popupOpen]);

  return {
    sendLink: magicLink.mutate,
    sending: magicLink.isPending,
    sent: magicLink.isSuccess,
    signInWithGoogle: google.mutate,
    googleWaiting: popupOpen,
    error: magicLink.error?.message ?? google.error?.message ?? null,
  };
}
