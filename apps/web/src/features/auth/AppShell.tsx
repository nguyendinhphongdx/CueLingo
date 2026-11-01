'use client';

import { Button } from '@cuelingo/ui/components/button';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { authClient } from '../../lib/auth-client';

/** Frame for every signed-in page: sends visitors without a session to /login, shows who is signed in. */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) router.replace('/login');
  }, [isPending, session, router]);

  if (isPending || !session) {
    return (
      <main className="text-muted-foreground flex min-h-screen items-center justify-center text-sm">
        Đang kiểm tra phiên đăng nhập…
      </main>
    );
  }

  const signOut = async () => {
    await authClient.signOut();
    router.replace('/login');
  };

  return (
    <div className="mx-auto max-w-3xl p-4">
      <header className="mb-6 flex items-center justify-between border-b pb-3">
        <span className="font-semibold">CueLingo</span>
        <span className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{session.user.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}>
            Đăng xuất
          </Button>
        </span>
      </header>
      {children}
    </div>
  );
}
