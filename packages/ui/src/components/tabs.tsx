import { useId, type KeyboardEvent } from 'react';
import type * as React from 'react';
import { cn } from '../lib/utils';

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps extends Omit<React.ComponentProps<'div'>, 'onChange'> {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  'aria-label': string;
  /** Set when two Tabs share a page; the panel uses `${idPrefix}-panel-${id}`. */
  idPrefix?: string;
}

/** Underline tabs with arrow-key navigation; the caller renders the role=tabpanel for the selected id. */
function Tabs({ tabs, value, onChange, className, idPrefix, ...props }: TabsProps) {
  const auto = useId();
  const prefix = idPrefix ?? auto;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.id === value);
    const last = tabs.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? index >= last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft'
          ? index <= 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : -1;
    const target = tabs[next];
    if (!target) return;
    event.preventDefault();
    onChange(target.id);
    document.getElementById(`${prefix}-tab-${target.id}`)?.focus();
  }

  return (
    <div
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn('border-border flex gap-1 border-b', className)}
      {...props}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${prefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${prefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              'focus-visible:ring-ring -mb-px h-10 cursor-pointer border-b-2 px-4 text-sm font-medium transition-colors duration-[var(--duration-fast)] outline-none focus-visible:ring-2',
              selected
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export { Tabs };
