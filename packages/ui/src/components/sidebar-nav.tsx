import { Highlight, HighlightItem } from '@animate-ui/react/primitives/effects/highlight';
import { spring } from '@animate-ui/react/utils/motion';
import type { ReactNode } from 'react';
import { featureGroups, features, type Feature, type FeatureStatus } from '../lib/roadmap';
import { FeatureIcon } from './feature-icon';

export interface SidebarNavProps {
  brand: ReactNode;
  activeId: string;
  /** Which client this is, to read each feature's status from the roadmap. */
  client: 'desktop' | 'web';
  /**
   * Renders one nav entry. Return a `<button>` (desktop) or a router `<Link>` (web); put `className`
   * and `children` on it and set `aria-current` from `active`.
   */
  renderItem: (
    feature: Feature,
    parts: { className: string; children: ReactNode; active: boolean },
  ) => ReactNode;
  footer?: ReactNode;
  topInset?: string;
}

export function SidebarNav({
  brand,
  activeId,
  client,
  renderItem,
  footer,
  topInset = 'pt-6',
}: SidebarNavProps) {
  return (
    <aside
      className={`bg-muted/60 flex h-full w-[220px] shrink-0 flex-col overflow-hidden border-r px-3 pb-5 ${topInset}`}
    >
      <div className="px-2">{brand}</div>
      <nav aria-label="Điều hướng chính" className="mt-6">
        <Highlight
          value={activeId}
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
                .map((feature) => {
                  const active = feature.id === activeId;
                  const status: FeatureStatus = feature.status[client];
                  return (
                    <HighlightItem key={feature.id} value={feature.id}>
                      {renderItem(feature, {
                        active,
                        className: `focus-visible:ring-ring flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                          active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`,
                        children: (
                          <>
                            <FeatureIcon
                              name={feature.icon}
                              className={`size-[18px] ${active ? 'text-primary' : ''}`}
                            />
                            <span className="flex-1">{feature.label}</span>
                            {status === 'soon' ? (
                              <span className="bg-muted-foreground/60 size-1.5 rounded-full">
                                <span className="sr-only">Sắp ra mắt</span>
                              </span>
                            ) : null}
                          </>
                        ),
                      })}
                    </HighlightItem>
                  );
                })}
            </div>
          ))}
        </Highlight>
      </nav>
      {footer ? <div className="mt-auto px-2">{footer}</div> : null}
    </aside>
  );
}
