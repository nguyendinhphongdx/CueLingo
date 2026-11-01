import { Highlight, HighlightItem } from '@animate-ui/react/primitives/effects/highlight';
import { spring } from '@animate-ui/react/utils/motion';
import type { ReactNode } from 'react';
import { APP_NAME, APP_TAGLINE, APP_VERSION, Logo } from './Logo';

export type View = 'home' | 'settings';

const navItems: Array<{ view: View; label: string; icon: string }> = [
  { view: 'home', label: 'Phiên họp', icon: '🎙️' },
  { view: 'settings', label: 'Cài đặt', icon: '⚙️' },
];

interface AppShellProps {
  view: View;
  onNavigate: (view: View) => void;
  children: ReactNode;
}

/** Window frame: brand and navigation on the left, the current view on the right. */
export function AppShell({ view, onNavigate, children }: AppShellProps) {
  return (
    <div className="bg-background text-foreground flex min-h-screen">
      <aside className="bg-muted/40 flex w-56 shrink-0 flex-col border-r px-4 py-6">
        <div className="flex items-center gap-3 px-1">
          <Logo size={40} />
          <div>
            <p className="text-lg leading-tight font-semibold tracking-tight">{APP_NAME}</p>
            <p className="text-muted-foreground text-xs">v{APP_VERSION}</p>
          </div>
        </div>
        <nav aria-label="Điều hướng chính" className="mt-8">
          <Highlight
            value={view}
            hover={false}
            transition={spring.pop}
            className="bg-background rounded-lg shadow-sm"
            containerClassName="flex flex-col gap-1"
            mode="parent"
          >
            {navItems.map((item) => (
              <HighlightItem key={item.view} value={item.view}>
                <button
                  type="button"
                  aria-current={view === item.view ? 'page' : undefined}
                  onClick={() => onNavigate(item.view)}
                  className={`focus-visible:ring-ring flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                    view === item.view ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </button>
              </HighlightItem>
            ))}
          </Highlight>
        </nav>
        <p className="text-muted-foreground mt-auto px-1 text-xs leading-relaxed">{APP_TAGLINE}</p>
      </aside>
      <main className="flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
