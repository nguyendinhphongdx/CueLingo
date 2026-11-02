'use client';

import { Button } from '@cuelingo/ui/components/button';
import { Logo } from '@cuelingo/ui/components/logo';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { authClient } from '../../lib/auth-client';
import { client } from '../../lib/client';

/** Where the desktop app lands the browser after sign-in; the app registers this scheme with macOS. */
export const appLink = (code: string) => `cuelingo://auth?code=${encodeURIComponent(code)}`;

type Phase = 'checking' | 'no-session' | 'minting' | 'ready' | 'error';

/**
 * Hands a signed-in web session to the desktop app: confirm the session, mint a one-time code and
 * open the app with it. It asks for the session itself once instead of trusting a hook that may not
 * have loaded yet, and never bounces back to the login page on its own.
 */
export function AppAuthPage() {
  const [phase, setPhase] = useState<Phase>('checking');
  const started = useRef(false);
  const mint = useMutation({
    mutationFn: () => client.device.createCode(),
    onSuccess: ({ code }) => {
      setPhase('ready');
      window.location.href = appLink(code);
    },
    onError: () => setPhase('error'),
  });
  const { mutate } = mint;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    authClient
      .getSession()
      .then(({ data }) => {
        if (!data) {
          setPhase('no-session');
          return;
        }
        setPhase('minting');
        mutate();
      })
      .catch(() => setPhase('error'));
  }, [mutate]);

  const title: Record<Phase, string> = {
    checking: 'Đang kiểm tra đăng nhập…',
    minting: 'Đang mở CueLingo…',
    ready: 'Đang mở CueLingo…',
    'no-session': 'Trình duyệt chưa nhận được phiên đăng nhập',
    error: 'Chưa mở được CueLingo',
  };
  const hint: Record<Phase, string> = {
    checking: 'Vui lòng đợi một chút.',
    minting: 'Vui lòng đợi một chút.',
    ready: 'Nếu trình duyệt hỏi, bấm “Mở CueLingo”. Bạn có thể đóng tab này sau khi app đã mở.',
    'no-session':
      'Liên kết đăng nhập chỉ dùng được một lần, và trình duyệt cần cho phép lưu cookie của localhost. Hãy gửi liên kết mới rồi mở nó trong cùng trình duyệt này.',
    error: 'Không tạo được mã đăng nhập cho app. Hãy thử lại.',
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5 text-center">
        <Logo size={48} className="mx-auto rounded-[22%]" />
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">{title[phase]}</h1>
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {hint[phase]}
          </p>
        </div>
        <div className="flex justify-center gap-2">
          {phase === 'ready' && mint.data ? (
            <Button
              className="min-h-11"
              onClick={() => (window.location.href = appLink(mint.data.code))}
            >
              Mở CueLingo
            </Button>
          ) : null}
          {phase === 'error' ? (
            <Button
              className="min-h-11"
              onClick={() => {
                setPhase('minting');
                mutate();
              }}
            >
              Thử lại
            </Button>
          ) : null}
          {phase === 'no-session' ? (
            <Button className="min-h-11" onClick={() => (window.location.href = '/login?app=1')}>
              Gửi liên kết đăng nhập mới
            </Button>
          ) : null}
        </div>
      </div>
    </main>
  );
}
