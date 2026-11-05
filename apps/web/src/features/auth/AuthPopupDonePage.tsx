'use client';

import { Logo } from '@cuelingo/ui/components/logo';
import { useEffect } from 'react';
import { POPUP_CHANNEL, POPUP_MESSAGE } from './use-login';

/** The last page of the Google popup: tell the login page it is done, then close. */
export function AuthPopupDonePage() {
  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get('error');
    const message = { type: POPUP_MESSAGE, ok: error === null, error: error ?? undefined };
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(POPUP_CHANNEL);
      channel.postMessage(message);
      channel.close();
    }
    window.opener?.postMessage(message, window.location.origin);
    window.close();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="space-y-3 text-center">
        <Logo size={40} className="mx-auto rounded-[22%]" />
        <p className="text-muted-foreground text-sm" aria-live="polite">
          Đăng nhập xong. Bạn có thể đóng cửa sổ này.
        </p>
      </div>
    </main>
  );
}
