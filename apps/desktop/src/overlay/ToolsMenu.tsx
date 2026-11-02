import { Check } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

export interface ToolItem {
  id: string;
  label: string;
  /** Short description under the label. */
  description?: string;
  /** Keyboard shortcut shown on the right. */
  hint?: string;
  icon: ReactNode;
  /** The drawer for this tool is showing now. */
  active?: boolean;
  onSelect(): void;
}

/**
 * Dropdown of the overlay's tools. Adding a tool means adding one item to the list the overlay passes in;
 * the menu itself never changes.
 */
export function ToolsMenu({ items, onClose }: { items: ToolItem[]; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
      buttons[(next + buttons.length) % buttons.length]?.focus();
      event.preventDefault();
    };
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Công cụ hỗ trợ"
      className="bg-card absolute top-12 right-3 z-30 w-[300px] max-w-[calc(100%-1.5rem)] rounded-xl border p-1.5 shadow-2xl"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          onClick={() => {
            item.onSelect();
            onClose();
          }}
          className="focus-visible:ring-ring hover:bg-foreground/8 focus-visible:bg-foreground/8 flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-none"
        >
          <span className="text-muted-foreground flex size-8 shrink-0 items-center justify-center">
            {item.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{item.label}</span>
            {item.description ? (
              <span className="text-muted-foreground block truncate text-xs">
                {item.description}
              </span>
            ) : null}
          </span>
          {item.active ? (
            <Check aria-hidden="true" className="text-primary size-4 shrink-0" />
          ) : null}
          {item.hint ? (
            <kbd className="text-muted-foreground shrink-0 font-sans text-xs">{item.hint}</kbd>
          ) : null}
        </button>
      ))}
    </div>
  );
}
