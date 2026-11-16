'use client';

import { Highlight, HighlightItem } from '@animate-ui/react/primitives/effects/highlight';
import { spring } from '@animate-ui/react/utils/motion';
import { ChevronDown } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useCollapsedGroups } from '../hooks/use-collapsed-groups';
import { featureGroups, features, type FeatureStatus } from '../lib/roadmap';
import { FeatureIcon, type NavIconName } from './feature-icon';

/** One entry of the sidebar. A roadmap `Feature` has all of these fields, so it is a `NavItem` too. */
export interface NavItem {
  id: string;
  label: string;
  icon: NavIconName;
  /** Route on the web app. */
  webPath: string;
}

/** A group the client adds after the roadmap groups (the web adds the admin group). */
export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

export interface SidebarNavProps {
  brand: ReactNode;
  activeId: string;
  /** Which client this is, to read each feature's status from the roadmap. */
  client: 'desktop' | 'web';
  /**
   * Renders one nav entry. Return a `<button>` (desktop) or a router `<Link>` (web); put `className`
   * and `children` on it and set `aria-current` from `active`. Method syntax on purpose: a client that
   * never passes `extraGroups` may type the first argument as a roadmap `Feature`.
   */
  renderItem(
    item: NavItem,
    parts: { className: string; children: ReactNode; active: boolean; onSelect: () => void },
  ): ReactNode;
  /** Shown after the roadmap groups, folded and remembered like them. */
  extraGroups?: NavGroup[];
  footer?: ReactNode;
  topInset?: string;
  /** Collapses into AppFrame's mobile drawer while keeping the desktop client unchanged. */
  responsive?: boolean;
  mobileOpen?: boolean;
  onItemSelect?: () => void;
}

interface Row {
  item: NavItem;
  soon: boolean;
}
interface Section {
  id: string;
  title: string;
  rows: Row[];
}

export function SidebarNav({
  brand,
  activeId,
  client,
  renderItem,
  extraGroups = [],
  footer,
  topInset = 'pt-6',
  responsive = false,
  mobileOpen = false,
  onItemSelect,
}: SidebarNavProps) {
  const { isCollapsed, toggle, expand } = useCollapsedGroups();

  const sections: Section[] = [
    ...featureGroups.map((group) => ({
      id: group.id,
      title: group.title,
      rows: features
        .filter((feature) => feature.group === group.id)
        .map((feature) => ({
          item: feature,
          soon: (feature.status[client] satisfies FeatureStatus) === 'soon',
        })),
    })),
    ...extraGroups.map((group) => ({
      id: group.id,
      title: group.title,
      rows: group.items.map((item) => ({ item, soon: false })),
    })),
  ];

  // Opening a page (a link, the back button) unfolds the group that holds it, so the current entry is never hidden.
  const activeGroup = sections.find((s) => s.rows.some((r) => r.item.id === activeId))?.id;
  useEffect(() => {
    if (activeGroup) expand(activeGroup);
  }, [activeGroup, activeId, expand]);

  return (
    <aside
      id={responsive ? 'mobile-navigation' : undefined}
      className={`bg-muted/60 h-full w-[220px] shrink-0 flex-col overflow-hidden border-r px-3 pb-5 ${topInset} ${
        responsive
          ? `${mobileOpen ? 'flex' : 'hidden'} absolute top-16 bottom-0 left-0 z-30 h-auto w-[min(320px,calc(100vw-3rem))] shadow-xl md:static md:flex md:h-full md:w-[220px] md:shadow-none`
          : 'flex'
      }`}
    >
      <div className={responsive ? 'hidden px-2 md:block' : 'px-2'}>{brand}</div>
      <nav
        aria-label="Điều hướng chính"
        className={`scroll-auto-hide min-h-0 flex-1 overflow-y-auto ${responsive ? 'md:mt-6' : 'mt-6'}`}
      >
        <Highlight
          value={activeId}
          hover={false}
          controlledItems
          transition={spring.pop}
          className="bg-card rounded-lg shadow-sm ring-1 ring-black/5 dark:ring-white/10"
        >
          {sections.map((section) => {
            const folded = isCollapsed(section.id);
            const listId = `sidebar-group-${section.id}`;
            return (
              <div key={section.id} className="mb-3 flex flex-col gap-0.5">
                <button
                  type="button"
                  aria-expanded={!folded}
                  aria-controls={listId}
                  onClick={() => toggle(section.id)}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex min-h-8 w-full cursor-pointer items-center justify-between rounded-lg px-3 text-left text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  {section.title}
                  <ChevronDown
                    aria-hidden="true"
                    className={`size-3.5 transition-transform ${folded ? '-rotate-90' : ''}`}
                  />
                </button>
                <div id={listId} hidden={folded} className="flex flex-col gap-0.5">
                  {section.rows.map(({ item, soon }) => {
                    const active = item.id === activeId;
                    return (
                      <HighlightItem key={item.id} value={item.id}>
                        {renderItem(item, {
                          active,
                          onSelect: () => onItemSelect?.(),
                          className: `focus-visible:ring-ring flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                            active
                              ? 'text-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          }`,
                          children: (
                            <>
                              <FeatureIcon
                                name={item.icon}
                                className={`size-[18px] ${active ? 'text-primary' : ''}`}
                              />
                              <span className="flex-1">{item.label}</span>
                              {soon ? (
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
              </div>
            );
          })}
        </Highlight>
      </nav>
      {footer ? <div className="mt-auto px-2">{footer}</div> : null}
    </aside>
  );
}
