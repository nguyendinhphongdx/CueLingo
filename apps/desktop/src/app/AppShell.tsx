import { AppFrame } from '@cuelingo/ui/components/app-frame';
import { Logo } from '@cuelingo/ui/components/logo';
import type { ReactNode } from 'react';
import { APP_NAME, APP_TAGLINE, APP_VERSION } from './Logo';

interface AppShellProps {
  view: string;
  onNavigate: (view: string) => void;
  children: ReactNode;
}

/** Window frame: brand and navigation on the left, the current view on the right. */
export function AppShell({ view, onNavigate, children }: AppShellProps) {
  return (
    <AppFrame
      dragRegion
      nav={{
        client: 'desktop',
        activeId: view,
        brand: (
          <div className="flex items-center gap-3">
            <Logo size={36} className="rounded-[22%]" />
            <div className="min-w-0">
              <p className="text-[15px] leading-tight font-semibold tracking-tight">{APP_NAME}</p>
              <p className="text-muted-foreground text-xs">Phiên bản {APP_VERSION}</p>
            </div>
          </div>
        ),
        renderItem: (feature, { className, children: content, active }) => (
          <button
            type="button"
            className={className}
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate(feature.id)}
          >
            {content}
          </button>
        ),
      }}
      footer={<p className="text-muted-foreground text-xs leading-relaxed">{APP_TAGLINE}</p>}
    >
      {children}
    </AppFrame>
  );
}
