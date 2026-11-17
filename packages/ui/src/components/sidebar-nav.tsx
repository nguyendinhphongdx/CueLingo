'use client';

import { Highlight, HighlightItem } from '@animate-ui/react/primitives/effects/highlight';
import { spring } from '@animate-ui/react/utils/motion';
import { ChevronDown } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useCollapsedGroups } from '../hooks/use-collapsed-groups';
import { currentFeatureId, featureGroups, features, type FeatureStatus } from '../lib/roadmap';
import { Badge } from './badge';
import { FeatureIcon, type NavIconName } from './feature-icon';
import { LogoLockup } from './logo';

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
  /** The header; defaults to the logo lockup so every client shows the same one. */
  brand?: ReactNode;
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
  /** Who is signed in (an `AccountChip`), above the version line. */
  footer?: ReactNode;
  /** App version shown under the footer, as "Phiên bản …". */
  version?: string;
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
  brand = <LogoLockup />,
  activeId: requestedId,
  client,
  renderItem,
  extraGroups = [],
  footer,
  version,
  topInset = 'pt-6',
  responsive = false,
  mobileOpen = false,
  onItemSelect,
}: SidebarNavProps) {
  const { isCollapsed, toggle, expand } = useCollapsedGroups();
  // A view id from before the Ôn tập merge (`phrases`, `progress`) lights up its new home.
  const activeId = currentFeatureId(requestedId);

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
      className={`bg-sidebar text-sidebar-foreground h-full w-[240px] shrink-0 flex-col overflow-hidden border-r px-3 pb-3 ${topInset} ${
        responsive
          ? `${mobileOpen ? 'flex' : 'hidden'} absolute top-16 bottom-0 left-0 z-30 h-auto w-[min(320px,calc(100vw-3rem))] shadow-lg md:static md:flex md:h-full md:w-[240px] md:shadow-none`
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
          className="bg-sidebar-accent rounded-md"
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
                  className="text-muted-foreground hover:bg-sidebar-accent focus-visible:ring-ring text-overline flex h-8 w-full cursor-pointer items-center justify-between rounded-md px-2 text-left uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none"
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
                          className: `focus-visible:ring-ring flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left text-sm font-medium transition-colors md:min-h-9 focus-visible:ring-2 focus-visible:outline-none ${
                            active
                              ? 'text-primary font-semibold'
                              : 'text-sidebar-foreground hover:bg-sidebar-accent'
                          }`,
                          children: (
                            <>
                              <FeatureIcon name={item.icon} className="size-[18px] shrink-0" />
                              <span className="flex-1">{item.label}</span>
                              {soon ? (
                                <Badge variant="outline" className="px-2 py-0">
                                  <span aria-hidden="true">Sắp có</span>
                                  <span className="sr-only">Sắp ra mắt</span>
                                </Badge>
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
      {footer || version ? (
        <div className="mt-auto flex flex-col gap-2 border-t px-2 pt-3">
          {footer}
          {version ? (
            <p className="text-muted-foreground text-caption px-1">Phiên bản {version}</p>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
