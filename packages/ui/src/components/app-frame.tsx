import type { ReactNode } from 'react';
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
  return (
    <div className="bg-background text-foreground relative flex h-screen overflow-hidden">
      {dragRegion ? (
        <div data-tauri-drag-region className="absolute inset-x-0 top-0 z-10 h-9" />
      ) : null}
      <SidebarNav {...nav} footer={footer} topInset={dragRegion ? 'pt-12' : 'pt-6'} />
      <main
        className={`scroll-auto-hide h-full flex-1 overflow-y-auto px-10 pb-9 ${dragRegion ? 'pt-14' : 'pt-10'}`}
      >
        <div className="mx-auto flex max-w-[640px] flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
