'use client';

import { Button } from '@cuelingo/ui/components/button';
import { Logo } from '@cuelingo/ui/components/logo';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { authClient } from '../../lib/auth-client';
import { client } from '../../lib/client';

/** Where the desktop app lands the browser after sign-in; the app registers this scheme with macOS. */
const appLink = (code: string) => `cuelingo://auth?code=${encodeURIComponent(code)}`;

/** Hands a signed-in web session to the desktop app: mint a one-time code and open the app with it. */
export function AppAuthPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const started = useRef(false);
  const mint = useMutation({
    mutationFn: () => client.device.createCode(),
    onSuccess: ({ code }) => {
      window.location.href = appLink(code);
    },
  });

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.replace('/login?app=1');
      return;
    }
    if (!started.current) {
      started.current = true;
      mint.mutate();
    }
  }, [isPending, session, router, mint]);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5 text-center">
        <Logo size={48} className="mx-auto rounded-[22%]" />
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">
            {mint.isError ? 'Chưa mở được CueLingo' : 'Đang mở CueLingo…'}
          </h1>
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {mint.isError
              ? 'Không tạo được mã đăng nhập. Hãy thử lại.'
              : 'Nếu trình duyệt hỏi, bấm “Mở CueLingo”. Bạn có thể đóng tab này sau khi app đã mở.'}
          </p>
        </div>
        <div className="flex justify-center gap-2">
          {mint.isSuccess ? (
            <Button
              className="min-h-11"
              onClick={() => (window.location.href = appLink(mint.data.code))}
            >
              Mở CueLingo
            </Button>
          ) : null}
          {mint.isError ? (
            <Button className="min-h-11" onClick={() => mint.mutate()}>
              Thử lại
            </Button>
          ) : null}
        </div>
      </div>
    </main>
  );
}
