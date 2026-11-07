import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm(): void;
  onCancel(): void;
  /**
   * Where the focus starts. `confirm` (default) suits a person's own action; use `cancel` when the question comes
   * from content the person did not write, so a stray Enter or Space refuses instead of agreeing.
   */
  initialFocus?: 'confirm' | 'cancel';
  /** Keeps the confirm button disabled for this long after the dialog opens (a click made for something else). */
  confirmDelayMs?: number;
}

/** A modal that asks the person to agree before something happens; Escape and the backdrop cancel. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  // Mounted only while open, so the focus and the delay start over each time.
  return props.open ? <OpenDialog {...props} /> : null;
}

function OpenDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  initialFocus = 'confirm',
  confirmDelayMs = 0,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [armed, setArmed] = useState(confirmDelayMs <= 0);
  useEffect(() => {
    if (initialFocus === 'cancel') cancelRef.current?.focus();
  }, [initialFocus]);
  useEffect(() => {
    if (confirmDelayMs <= 0) return;
    const timer = setTimeout(() => setArmed(true), confirmDelayMs);
    return () => clearTimeout(timer);
  }, [confirmDelayMs]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
        className="bg-card text-card-foreground w-full max-w-md rounded-2xl border p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p id="confirm-dialog-body" className="text-muted-foreground mt-2 text-sm">
          {children}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button ref={cancelRef} variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button autoFocus={initialFocus === 'confirm'} disabled={!armed} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
