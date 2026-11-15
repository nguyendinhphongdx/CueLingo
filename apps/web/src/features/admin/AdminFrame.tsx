'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminNav } from './AdminNav';

/**
 * The page shell shared by the admin screens. `nav` is false until the page knows the caller is an admin
 * (its first answer arrived without 401/403), so a stranger never sees the links flash before `notFound()`.
 */
export function AdminFrame({
  width = 'narrow',
  nav = true,
  children,
}: {
  width?: 'narrow' | 'wide';
  nav?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <main
      className={`mx-auto min-h-screen w-full px-4 py-8 sm:px-6 lg:px-8 ${
        width === 'wide' ? 'max-w-6xl' : 'max-w-4xl'
      }`}
    >
      {nav && <AdminNav pathname={pathname} />}
      {children}
    </main>
  );
}
