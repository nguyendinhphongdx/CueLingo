import { Button } from '@cuelingo/ui/components/button';
import { Captions } from 'lucide-react';
import { native } from '../lib/native';

/**
 * Brings the caption overlay back. The ✕ on the overlay only hides it, and the other ways back (the shortcut,
 * the tray menu) are easy to miss on Windows, where the tray icon sits in the hidden area: without a button in
 * the main window the only way to see captions again was to stop the meeting and start another.
 */
export function ShowOverlayButton({ className }: { className?: string }) {
  return (
    <Button
      variant="ghost"
      size="lg"
      className={className}
      onClick={() => void native.showOverlay().catch(() => undefined)}
    >
      <Captions aria-hidden="true" className="size-4" />
      Hiện overlay
    </Button>
  );
}
