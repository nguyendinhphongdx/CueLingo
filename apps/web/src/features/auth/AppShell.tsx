'use client';

import { Button } from '@cuelingo/ui/components/button';
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

  return (
    <div className="mx-auto max-w-3xl p-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <span className="font-semibold">CueLingo</span>
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <span className="text-muted-foreground hidden truncate sm:inline">
            {session.user.email}
          </span>
          <Button variant="outline" className="min-h-11" onClick={signOut}>
            Đăng xuất
          </Button>
        </span>
      </header>
      <nav aria-label="Điều hướng chính" className="mb-6 flex gap-2 border-b pb-3">
        {[
          { href: '/sessions', label: 'Cuộc họp' },
          { href: '/glossary', label: 'Thuật ngữ' },
        ].map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`focus-visible:ring-ring inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
