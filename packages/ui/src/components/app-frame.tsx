'use client';

import { Menu, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMobileNavigation } from '../hooks/use-mobile-navigation';
import { SidebarNav, type SidebarNavProps } from './sidebar-nav';

/**
 * Frame for every signed-in screen: a sidebar that never scrolls and a content area that does,
 * with its scrollbar shown only while the pointer is over it.
 */
export function AppFrame({
  nav,
  footer,
  dragRegion,
  children,
}: {
  nav: SidebarNavProps;
  footer?: ReactNode;
  /** Adds a strip along the top for dragging a window with a transparent title bar (desktop). */
  dragRegion?: boolean;
  children: ReactNode;
}) {
  const mobileNavigation = useMobileNavigation();
  const responsive = !dragRegion;

  return (
    <div className="bg-background text-foreground relative flex h-screen overflow-hidden">
      {dragRegion ? (
        <div data-tauri-drag-region className="absolute inset-x-0 top-0 z-10 h-9" />
      ) : null}
      {responsive ? (
        <header className="bg-background absolute inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b px-4 md:hidden">
          <div className="min-w-0">{nav.brand}</div>
          <button
            type="button"
            aria-label={mobileNavigation.open ? 'Đóng trình đơn' : 'Mở trình đơn'}
            aria-expanded={mobileNavigation.open}
            aria-controls="mobile-navigation"
            onClick={mobileNavigation.toggle}
            className="focus-visible:ring-ring inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
          >
            {mobileNavigation.open ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <Menu aria-hidden="true" className="size-5" />
            )}
          </button>
        </header>
      ) : null}
      {responsive && mobileNavigation.open ? (
        <button
          type="button"
          aria-label="Đóng trình đơn"
          onClick={mobileNavigation.close}
          className="absolute inset-x-0 top-16 bottom-0 z-20 cursor-default bg-black/30 md:hidden"
        />
      ) : null}
      <SidebarNav
        {...nav}
        footer={footer}
        topInset={dragRegion ? 'pt-12' : 'pt-6'}
        responsive={responsive}
        mobileOpen={mobileNavigation.open}
        onItemSelect={mobileNavigation.close}
      />
      <main
        className={`scroll-auto-hide h-full min-w-0 flex-1 overflow-y-auto px-4 pb-9 md:px-10 ${dragRegion ? 'pt-14' : 'pt-20 md:pt-10'}`}
      >
        <div className="mx-auto flex max-w-[640px] flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
