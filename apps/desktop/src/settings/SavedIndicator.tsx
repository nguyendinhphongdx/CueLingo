import { Check } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

export const SAVED_TEXT = 'Đã lưu';
/** How long "Đã lưu" stays after a change is stored. */
export const SAVED_SHOWN_MS = 2500;

/**
 * "Đã lưu" for a setting that saves by itself. The live region is always in the page and only its text
 * changes, so a screen reader announces the save without moving focus.
 */
export function SavedIndicator({ saved }: { saved: boolean }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="text-success inline-flex min-h-5 items-center gap-1 text-xs font-medium"
    >
      {saved ? (
        <>
          <Check aria-hidden="true" className="size-3.5" />
          {SAVED_TEXT}
        </>
      ) : null}
    </p>
  );
}

/** `saved` turns true when `markSaved` is called and falls back after `ms`; a new save restarts the wait. */
export function useSavedFlash(ms = SAVED_SHOWN_MS) {
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  const markSaved = useCallback(() => {
    clear();
    setSaved(true);
    timer.current = setTimeout(() => setSaved(false), ms);
  }, [ms]);
  const reset = useCallback(() => {
    clear();
    setSaved(false);
  }, []);
  return { saved, markSaved, reset };
}
