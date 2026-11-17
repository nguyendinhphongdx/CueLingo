'use client';

import { Button } from '@cuelingo/ui/components/button';
import { Card, CardContent } from '@cuelingo/ui/components/card';
import { Logo } from '@cuelingo/ui/components/logo';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { authClient } from '../../lib/auth-client';
import { client } from '../../lib/client';

/** Where the desktop app lands the browser after sign-in; the app registers this scheme with macOS. */
export const appLink = (code: string) => `cuelingo://auth?code=${encodeURIComponent(code)}`;

type Phase = 'checking' | 'no-session' | 'consent' | 'cancelled' | 'minting' | 'ready' | 'error';

/**
 * Hands a signed-in web session to the desktop app: confirm the session, ask the person to allow this
 * device, then mint a one-time code and open the app with it. No code exists until "Cho phép" is pressed,
 * so cancelling leaves nothing to forward. It asks for the session itself once instead of trusting a hook
 * that may not have loaded yet, and never bounces back to the login page on its own.
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
        setPhase('consent');
      })
      .catch(() => setPhase('error'));
  }, [mutate]);

  const title: Record<Phase, string> = {
    checking: 'Đang kiểm tra đăng nhập…',
    consent: 'Cho CueLingo trên máy này vào tài khoản?',
    cancelled: 'Đã huỷ, CueLingo chưa được vào tài khoản',
    minting: 'Đang mở CueLingo…',
    ready: 'Đang mở CueLingo…',
    'no-session': 'Trình duyệt chưa nhận được phiên đăng nhập',
    error: 'Chưa mở được CueLingo',
  };
  const hint: Record<Phase, string> = {
    checking: 'Vui lòng đợi một chút.',
    consent:
      'Thiết bị: CueLingo cho macOS. App sẽ đọc cuộc họp và cụm từ của bạn, và gửi caption để dịch. Bạn có thể thu hồi bất cứ lúc nào trong Cài đặt, mục Thiết bị.',
    cancelled: 'Không có mã nào được tạo. Bạn có thể đóng tab này.',
    minting: 'Vui lòng đợi một chút.',
    ready: 'Nếu trình duyệt hỏi, bấm “Mở CueLingo”. Bạn có thể đóng tab này sau khi app đã mở.',
    'no-session':
      'Liên kết đăng nhập chỉ dùng được một lần, và trình duyệt cần cho phép lưu cookie của localhost. Hãy gửi liên kết mới rồi mở nó trong cùng trình duyệt này.',
    error: 'Không tạo được mã đăng nhập cho app. Hãy thử lại.',
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-5 text-center">
          <Logo size={56} className="mx-auto rounded-[22%]" />
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight">{title[phase]}</h1>
            <p className="text-muted-foreground text-sm" aria-live="polite">
              {hint[phase]}
            </p>
          </div>
          <div className="flex justify-center gap-2">
            {phase === 'consent' ? (
              <>
                <Button
                  variant="outline"
                  className="min-h-11 grow"
                  autoFocus
                  onClick={() => setPhase('cancelled')}
                >
                  Không phải tôi, huỷ
                </Button>
                <Button
                  className="min-h-11 grow"
                  onClick={() => {
                    setPhase('minting');
                    mutate();
                  }}
                >
                  Cho phép
                </Button>
              </>
            ) : null}
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
        </CardContent>
      </Card>
    </main>
  );
}
