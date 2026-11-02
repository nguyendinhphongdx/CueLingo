'use client';

import { AppFrame } from '@cuelingo/ui/components/app-frame';
import { Button } from '@cuelingo/ui/components/button';
import { Logo } from '@cuelingo/ui/components/logo';
import { features } from '@cuelingo/ui/lib/roadmap';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { authClient } from '../../lib/auth-client';

/** Frame for every signed-in page: sends visitors without a session to /login, shows who is signed in. */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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
        <div className="space-y-2">
          <p
            className="text-muted-foreground truncate text-xs"
            title={session.user.name || session.user.email}
          >
            {session.user.name || session.user.email}
          </p>
          <Button variant="outline" className="min-h-11 w-full cursor-pointer" onClick={signOut}>
            Đăng xuất
          </Button>
        </div>
      }
    >
      {children}
    </AppFrame>
  );
}
