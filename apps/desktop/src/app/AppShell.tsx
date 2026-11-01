import { Highlight, HighlightItem } from '@animate-ui/react/primitives/effects/highlight';
import { spring } from '@animate-ui/react/utils/motion';
import type { ReactNode } from 'react';
import { featureGroups, features, type View } from './features';
import { APP_NAME, APP_TAGLINE, APP_VERSION, Logo } from './Logo';

export type { View };

interface AppShellProps {
  view: View;
  onNavigate: (view: View) => void;
  children: ReactNode;
}

/** Window frame: brand and navigation on the left, the current view on the right. */
export function AppShell({ view, onNavigate, children }: AppShellProps) {
  return (
    <div className="bg-background text-foreground relative flex h-screen overflow-hidden">
      {/* The native title bar is transparent; this strip lets the window be dragged. */}
      <div data-tauri-drag-region className="absolute inset-x-0 top-0 z-10 h-9" />
      <aside className="bg-muted/60 flex h-full w-[220px] shrink-0 flex-col overflow-hidden border-r px-3 pt-12 pb-5">
        <div className="flex items-center gap-3 px-2">
          <Logo size={36} />
          <div className="min-w-0">
            <p className="text-[15px] leading-tight font-semibold tracking-tight">{APP_NAME}</p>
            <p className="text-muted-foreground text-xs">Phiên bản {APP_VERSION}</p>
          </div>
        </div>
        <nav aria-label="Điều hướng chính" className="mt-6">
          <Highlight
            value={view}
            hover={false}
            controlledItems
            transition={spring.pop}
            className="bg-card rounded-lg shadow-sm ring-1 ring-black/5 dark:ring-white/10"
          >
            {featureGroups.map((group) => (
              <div key={group.id} className="mb-3 flex flex-col gap-0.5">
                <p className="text-muted-foreground px-3 pb-1 text-xs font-medium">{group.title}</p>
                {features
                  .filter((feature) => feature.group === group.id)
                  .map(({ view: target, label, icon: Icon, status }) => {
                    const active = view === target;
                    return (
                      <HighlightItem key={target} value={target}>
                        <button
                          type="button"
                          aria-current={active ? 'page' : undefined}
                          onClick={() => onNavigate(target)}
                          className={`focus-visible:ring-ring flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                            active
                              ? 'text-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Icon
                            aria-hidden="true"
                            className={`size-[18px] ${active ? 'text-primary' : ''}`}
                            strokeWidth={2}
                          />
                          <span className="flex-1">{label}</span>
                          {status === 'soon' ? (
                            <span
                              className="bg-muted-foreground/60 size-1.5 rounded-full"
                              title="Sắp ra mắt"
                            >
                              <span className="sr-only">Sắp ra mắt</span>
                            </span>
                          ) : null}
                        </button>
                      </HighlightItem>
                    );
                  })}
              </div>
            ))}
          </Highlight>
        </nav>
        <p className="text-muted-foreground mt-auto px-2 text-xs leading-relaxed">{APP_TAGLINE}</p>
      </aside>
      <main className="scroll-auto-hide h-full flex-1 overflow-y-auto px-10 pt-14 pb-9">
        <div className="mx-auto flex max-w-[640px] flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
