import { Check, Copy, Loader2, Square, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';
import { IconButton } from './icon-button';
import { useSpeaker } from './speak-button';

type CopyStatus = 'idle' | 'copied' | 'error';

/**
 * One sentence the assistant drafted for the person to say: the English, a Vietnamese note under it,
 * and a row to hear it (loading, playing, stop) and to copy it. The copy itself belongs to the client.
 */
export function SpeakableOption({
  text,
  note,
  loadAudio,
  onCopy,
  className,
}: {
  text: string;
  note?: string;
  loadAudio: (text: string) => Promise<Blob>;
  /** Puts the sentence on the clipboard; a rejection shows as "Không sao chép được". */
  onCopy: (text: string) => Promise<void>;
  className?: string;
}) {
  const { status, play, stop } = useSpeaker(loadAudio);
  const [copy, setCopy] = useState<CopyStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copyText() {
    clearTimeout(timer.current);
    try {
      await onCopy(text);
      setCopy('copied');
    } catch {
      setCopy('error');
    }
    timer.current = setTimeout(() => setCopy('idle'), 2000);
  }

  const listenIcon =
    status === 'loading' ? (
      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
    ) : status === 'playing' ? (
      <Square aria-hidden="true" className="size-3.5 fill-current" />
    ) : (
      <Volume2 aria-hidden="true" className="size-4" />
    );

  return (
    <div data-slot="speakable-option" className={cn('rounded-xl border px-3 py-2.5', className)}>
      <p className="text-base leading-snug">{text}</p>
      {note ? <p className="text-muted-foreground mt-1 text-xs">{note}</p> : null}
      <div className="mt-2 flex items-center gap-1">
        <IconButton
          label={
            status === 'error'
              ? 'Không phát được, bấm để thử lại'
              : status === 'playing'
                ? 'Dừng'
                : 'Nghe thử'
          }
          aria-busy={status === 'loading'}
          active={status === 'playing'}
          icon={listenIcon}
          onClick={() => (status === 'playing' ? stop() : void play(text))}
        />
        <IconButton
          label={copy === 'error' ? 'Không sao chép được, bấm để thử lại' : 'Sao chép'}
          icon={
            copy === 'copied' ? (
              <Check aria-hidden="true" className="size-4" />
            ) : (
              <Copy aria-hidden="true" className="size-4" />
            )
          }
          onClick={() => void copyText()}
        />
        <span aria-live="polite" className="text-muted-foreground text-xs">
          {copy === 'copied' ? 'Đã sao chép' : status === 'error' ? 'Không phát được' : ''}
        </span>
      </div>
    </div>
  );
}
