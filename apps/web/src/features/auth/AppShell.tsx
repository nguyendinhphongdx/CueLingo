'use client';

import { Button } from '@cuelingo/ui/components/button';
import { AppFrame } from '@cuelingo/ui/components/app-frame';
import { AccountChip } from '@cuelingo/ui/components/account-chip';
import { Logo } from '@cuelingo/ui/components/logo';
import { features } from '@cuelingo/ui/lib/roadmap';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { authClient } from '../../lib/auth-client';
import { CONNECTION_ERROR_MESSAGE } from '../../lib/errors';

/** Full-page notice when the API cannot be reached, with a way to try again. */
export function ConnectionProblem({ onRetry }: { onRetry: () => void }) {
  return (
    <main
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <p className="max-w-md text-sm">{CONNECTION_ERROR_MESSAGE}</p>
      <Button onClick={onRetry}>Thử lại</Button>
    </main>
  );
}

/** Frame for every signed-in page: sends visitors without a session to /login, shows who is signed in. */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending, error, refetch } = authClient.useSession();
  // The session request failed (API unreachable or erroring): that is not "signed out", so do not send them to /login.
  const unreachable = !isPending && !session && Boolean(error);

  useEffect(() => {
    if (!isPending && !session && !unreachable) router.replace('/login');
  }, [isPending, session, unreachable, router]);

  if (unreachable) return <ConnectionProblem onRetry={() => void refetch()} />;

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

  const activeId =
    features.find(
      (feature) => pathname === feature.webPath || pathname.startsWith(`${feature.webPath}/`),
    )?.id ?? '';

  return (
    <AppFrame
      nav={{
        client: 'web',
        activeId,
        brand: (
          <div className="flex items-center gap-3">
            <Logo size={36} className="rounded-[22%]" />
            <span className="text-[15px] leading-tight font-semibold tracking-tight">CueLingo</span>
          </div>
        ),
        renderItem: (feature, { className, children: content, active, onSelect }) => (
          <Link
            href={feature.webPath}
            aria-current={active ? 'page' : undefined}
            className={className}
            onClick={onSelect}
          >
            {content}
          </Link>
        ),
      }}
      footer={
        <AccountChip
          name={session.user.name}
          email={session.user.email}
          onOpen={() => router.push('/settings')}
          onSignOut={signOut}
        />
      }
    >
      {children}
    </AppFrame>
  );
}
