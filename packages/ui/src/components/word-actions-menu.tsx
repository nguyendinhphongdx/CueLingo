import { BookmarkCheck, BookmarkPlus, Loader2, Search, Volume2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clampMenuPosition, menuKeyAction } from '../lib/menu-keys';
import { cn } from '../lib/utils';
import type { SpeakStatus } from './speak-button';

/** What the lookup of the word has produced so far. */
export type WordLookup =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'done';
      meaningVi: string;
      pos?: string;
      exampleEn?: string;
      reading?: string;
      noteVi?: string;
    };

export interface WordActionsMenuProps {
  word: string;
  /** Viewport coordinates the menu opens at (the double-click). */
  position: { x: number; y: number };
  /** The word is already in the Phrase Bank. */
  saved: boolean;
  saving?: boolean;
  lookup: WordLookup;
  speakStatus?: SpeakStatus;
  onLookup: () => void;
  onSpeak: () => void;
  onSave: () => void;
  onClose: () => void;
}

const item =
  'focus-visible:bg-muted hover:bg-muted flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-2.5 text-left text-sm outline-none disabled:cursor-default aria-disabled:cursor-default';

/**
 * The small menu that opens on a word the person double-clicked: Tra nghĩa, Nghe, Lưu (Đã lưu when the
 * word is in the Phrase Bank). Focus moves into it, arrows move between items, Escape or a click outside
 * closes it. It calls back and shows state; it never calls the API itself.
 */
export function WordActionsMenu({
  word,
  position,
  saved,
  saving = false,
  lookup,
  speakStatus = 'idle',
  onLookup,
  onSpeak,
  onSave,
  onClose,
}: WordActionsMenuProps) {
  const menu = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState({ left: position.x, top: position.y });

  const items = () =>
    Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  useLayoutEffect(() => {
    const box = menu.current?.getBoundingClientRect();
    if (!box) return;
    setPlaced(
      clampMenuPosition(
        position,
        { width: box.width, height: box.height },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
    // The result panel grows the menu, so re-measure when it changes.
  }, [position, lookup.status]);

  useEffect(() => {
    items()[0]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
    // Focus and the outside-click listener are set up once per opening.
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const all = items();
    const action = menuKeyAction(
      event.key,
      all.indexOf(document.activeElement as HTMLElement),
      all.length,
    );
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    if (action.type === 'close') onClose();
    else all[action.index]?.focus();
  };

  return (
    <div
      ref={menu}
      role="menu"
      aria-label={`Thao tác với từ “${word}”`}
      onKeyDown={onKeyDown}
      style={{ position: 'fixed', left: placed.left, top: placed.top }}
      className="bg-popover text-popover-foreground z-50 w-64 max-w-[calc(100vw-1rem)] rounded-xl border p-1.5 shadow-lg"
    >
      <p className="text-muted-foreground truncate px-2.5 py-1.5 text-xs font-medium">{word}</p>
      <button type="button" role="menuitem" className={item} onClick={onLookup}>
        {lookup.status === 'loading' ? (
          <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />
        ) : (
          <Search aria-hidden="true" className="size-4" />
        )}
        Tra nghĩa
      </button>
      <button type="button" role="menuitem" className={item} onClick={onSpeak}>
        {speakStatus === 'loading' ? (
          <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />
        ) : (
          <Volume2 aria-hidden="true" className="size-4" />
        )}
        {speakStatus === 'error' ? 'Nghe (thử lại)' : 'Nghe'}
      </button>
      <button
        type="button"
        role="menuitem"
        aria-disabled={saved || saving}
        className={cn(item, saved && 'text-muted-foreground')}
        onClick={() => {
          if (!saved && !saving) onSave();
        }}
      >
        {saved ? (
          <BookmarkCheck aria-hidden="true" className="size-4" />
        ) : saving ? (
          <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />
        ) : (
          <BookmarkPlus aria-hidden="true" className="size-4" />
        )}
        {saved ? 'Đã lưu' : 'Lưu'}
      </button>
      <div aria-live="polite" className="empty:hidden">
        {lookup.status === 'done' ? (
          <div className="mt-1 space-y-1 border-t px-2.5 pt-2 pb-1 text-sm">
            <p>
              {lookup.pos ? <span className="text-muted-foreground">{lookup.pos} · </span> : null}
              {lookup.meaningVi}
            </p>
            {lookup.reading ? (
              <p className="text-muted-foreground text-xs">{lookup.reading}</p>
            ) : null}
            {lookup.exampleEn ? (
              <p className="text-muted-foreground text-xs italic">“{lookup.exampleEn}”</p>
            ) : null}
            {lookup.noteVi ? (
              <p className="text-muted-foreground text-xs">{lookup.noteVi}</p>
            ) : null}
          </div>
        ) : lookup.status === 'error' ? (
          <p role="alert" className="text-destructive mt-1 border-t px-2.5 pt-2 pb-1 text-xs">
            Chưa tra được từ này. Hãy thử lại.
          </p>
        ) : null}
      </div>
    </div>
  );
}
