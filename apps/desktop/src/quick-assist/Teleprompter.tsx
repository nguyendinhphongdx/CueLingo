import { Button } from '@cuelingo/ui/components/button';
import { useSpeaker } from '@cuelingo/ui/components/speak-button';
import { Check, Loader2, Square, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { studyApi } from '../study/study-api';

const SIZES = [
  { id: 'small', label: 'Chữ vừa', glyph: 'text-sm', text: 'text-3xl leading-tight' },
  { id: 'medium', label: 'Chữ lớn', glyph: 'text-base', text: 'text-5xl leading-tight' },
  { id: 'large', label: 'Chữ rất lớn', glyph: 'text-xl', text: 'text-6xl leading-tight' },
] as const;

type SizeId = (typeof SIZES)[number]['id'];

/**
 * "Nói giúp: chữ lớn": the chosen sentence in large type to read aloud, with Nghe and Sao chép.
 * It fills the overlay (solid background, so it reads on any meeting behind); Escape or the back
 * button returns to the options.
 */
export function Teleprompter({
  text,
  note,
  onBack,
  onCopy,
}: {
  text: string;
  note?: string;
  onBack(): void;
  onCopy(text: string): Promise<void>;
}) {
  const { status, play, stop } = useSpeaker(studyApi.speak);
  const [size, setSize] = useState<SizeId>('medium');
  const [copy, setCopy] = useState<'idle' | 'copied' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => back.current?.focus(), []);

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

  const current = SIZES.find((item) => item.id === size) ?? SIZES[1];

  return (
    <div
      role="dialog"
      aria-label="Nói giúp: chữ lớn"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onBack();
        }
      }}
      className="bg-background text-foreground fixed inset-0 z-50 flex flex-col rounded-2xl"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b px-6 py-3">
        <h2 className="text-base font-semibold">Nói giúp · chữ lớn</h2>
        <span className="text-muted-foreground text-sm">Đọc to câu này, hoặc bấm Nghe.</span>
        <Button ref={back} variant="outline" size="sm" className="ml-auto" onClick={onBack}>
          Quay lại các lựa chọn
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto p-8">
        <div className="max-w-4xl space-y-6 text-center">
          <p className={`${current.text} font-semibold tracking-tight`}>{text}</p>
          {note ? <p className="text-translation text-2xl leading-snug">{note}</p> : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t px-6 py-4">
        <Button
          size="lg"
          aria-busy={status === 'loading'}
          onClick={() => (status === 'playing' ? stop() : void play(text))}
        >
          {status === 'loading' ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : status === 'playing' ? (
            <Square aria-hidden="true" className="fill-current" />
          ) : (
            <Volume2 aria-hidden="true" />
          )}
          {status === 'playing' ? 'Dừng' : status === 'error' ? 'Thử nghe lại' : 'Nghe'}
        </Button>
        <Button variant="outline" size="lg" onClick={() => void copyText()}>
          {copy === 'copied' ? <Check aria-hidden="true" /> : null}
          {copy === 'copied'
            ? 'Đã sao chép'
            : copy === 'error'
              ? 'Không sao chép được, thử lại'
              : 'Sao chép'}
        </Button>
        <div role="group" aria-label="Cỡ chữ" className="bg-muted ml-4 flex rounded-xl p-1">
          {SIZES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === size}
              aria-label={item.label}
              onClick={() => setSize(item.id)}
              className={`focus-visible:ring-ring h-9 w-10 cursor-pointer rounded-lg font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none ${item.glyph} ${
                item.id === size
                  ? 'bg-card text-foreground ring-border ring-1'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              A
            </button>
          ))}
        </div>
        <span aria-live="polite" className="sr-only">
          {status === 'error' ? 'Không phát được' : ''}
        </span>
      </div>
    </div>
  );
}
