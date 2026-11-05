import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  exitOffset,
  isTap,
  ratingForKey,
  swipeRating,
  SWIPE_THRESHOLD,
  type DeckRating,
} from '../lib/swipe';
import { SpeakButton } from './speak-button';

/** The structural subset of a review card the deck needs; `@cuelingo/ui` does not depend on `shared`. */
export interface ReviewCardLike {
  itemId: string;
  exercise: string;
  phrase: string;
  prompt: string;
  answer: string;
  meaningVi: string | null;
  contextEn: string | null;
  language?: string;
}

const HINTS: Record<DeckRating, { label: string; className: string }> = {
  1: { label: 'Lại', className: 'bg-red-500/20 text-red-900 dark:text-red-100' },
  2: { label: 'Khó', className: 'bg-amber-500/20 text-amber-900 dark:text-amber-100' },
  3: { label: 'Được', className: 'bg-green-500/20 text-green-900 dark:text-green-100' },
  4: { label: 'Dễ', className: 'bg-sky-500/20 text-sky-900 dark:text-sky-100' },
};

const BUTTONS: { rating: DeckRating; icon: typeof ArrowLeft }[] = [
  { rating: 1, icon: ArrowLeft },
  { rating: 2, icon: ArrowDown },
  { rating: 3, icon: ArrowRight },
  { rating: 4, icon: ArrowUp },
];

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/** Markup only: the card as it looks in one state, so it can be rendered and tested without a pointer. */
export function FlashcardFace({
  card,
  flipped,
  loadAudio,
}: {
  card: ReviewCardLike;
  flipped: boolean;
  loadAudio?: (text: string) => Promise<Blob>;
}) {
  const listening = card.exercise === 'dictation';
  const face =
    'absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl border bg-card p-6 text-center shadow-sm [backface-visibility:hidden]';
  return (
    <div
      className="relative h-full w-full transition-transform duration-500 ease-out [transform-style:preserve-3d] motion-reduce:transition-none"
      style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
    >
      <div className={face} aria-hidden={flipped}>
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {listening ? 'Nghe' : card.exercise === 'cloze' ? 'Điền chỗ trống' : 'Cụm từ'}
        </p>
        {listening ? (
          loadAudio ? (
            <SpeakButton text={card.prompt} loadAudio={loadAudio} />
          ) : null
        ) : null}
        <p className="text-2xl leading-relaxed font-semibold tracking-tight">
          {listening ? 'Bạn nghe được cụm từ nào?' : card.prompt}
        </p>
        <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <RotateCw className="size-4" aria-hidden="true" /> Chạm để lật
        </p>
      </div>
      <div
        className={face}
        style={{ transform: 'rotateY(180deg)' }}
        aria-hidden={!flipped}
        data-face="back"
      >
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Đáp án</p>
        <p className="flex items-center gap-1 text-2xl leading-relaxed font-semibold tracking-tight">
          {card.exercise === 'recognize' ? card.answer : card.phrase}
          {loadAudio ? <SpeakButton text={card.phrase} loadAudio={loadAudio} /> : null}
        </p>
        {card.exercise === 'recognize' ? (
          <p className="text-muted-foreground">{card.prompt}</p>
        ) : card.meaningVi ? (
          <p>{card.meaningVi}</p>
        ) : null}
        {card.contextEn ? (
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed italic">
            “{card.contextEn}”
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * One review card you turn over and throw: tap to flip, then swipe right (Được), left (Lại),
 * up (Dễ) or down (Khó). Buttons and the keyboard do the same, so nothing needs a pointer.
 */
export function FlashcardDeck({
  card,
  position,
  total,
  submitting,
  onRate,
  loadAudio,
}: {
  card: ReviewCardLike;
  position: number;
  total: number;
  submitting: boolean;
  onRate: (rating: DeckRating) => void;
  loadAudio?: (text: string) => Promise<Blob>;
}) {
  const [flipped, setFlipped] = useState(false);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [leaving, setLeaving] = useState<DeckRating | null>(null);
  const [nudge, setNudge] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const exitTimer = useRef<number | null>(null);

  // Leaving the page mid-throw must not grade the card afterwards.
  useEffect(
    () => () => {
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
    },
    [],
  );

  // A new card starts face up and in place.
  useEffect(() => {
    setFlipped(false);
    setDrag({ x: 0, y: 0 });
    setLeaving(null);
    setNudge(false);
  }, [card.itemId]);

  const rate = useCallback(
    (rating: DeckRating) => {
      if (submitting || leaving) return;
      if (!flipped) {
        setNudge(true);
        return;
      }
      if (prefersReducedMotion()) {
        onRate(rating);
        return;
      }
      setLeaving(rating);
      const { x, y } = exitOffset(rating);
      setDrag({ x, y });
      exitTimer.current = window.setTimeout(() => {
        exitTimer.current = null;
        onRate(rating);
      }, 220);
    },
    [flipped, leaving, onRate, submitting],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      if (event.key === ' ' || event.key === 'Enter') {
        if (target?.closest('button')) return;
        event.preventDefault();
        setFlipped((value) => !value);
        return;
      }
      const rating = ratingForKey(event.key);
      if (rating) {
        event.preventDefault();
        rate(rating);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rate]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    start.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!start.current || leaving) return;
    setDrag({ x: event.clientX - start.current.x, y: event.clientY - start.current.y });
  };
  const onPointerUp = () => {
    if (!start.current || leaving) return;
    const { x, y } = drag;
    start.current = null;
    if (isTap(x, y)) {
      setDrag({ x: 0, y: 0 });
      setFlipped((value) => !value);
      return;
    }
    const rating = swipeRating(x, y);
    if (rating && flipped) rate(rating);
    else {
      if (rating) setNudge(true);
      setDrag({ x: 0, y: 0 });
    }
  };

  const heading = flipped ? swipeRating(drag.x, drag.y, SWIPE_THRESHOLD / 2) : null;
  const dragging = start.current !== null && !leaving;
  const tilt = Math.max(-12, Math.min(12, drag.x / 12));

  return (
    <div className="flex w-full max-w-[560px] flex-col gap-4 self-center">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Lật thẻ</span>
        <span className="font-medium tabular-nums" aria-label={`Thẻ ${position} trên ${total}`}>
          {position}/{total}
        </span>
      </div>
      <div
        className="bg-muted h-1.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Tiến độ phiên ôn tập"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={position}
      >
        <div
          className="bg-foreground h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${(position / total) * 100}%` }}
        />
      </div>

      <div
        className="relative h-72 touch-none select-none [perspective:1200px]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="group"
        aria-label="Thẻ ôn tập. Chạm hoặc nhấn Space để lật; vuốt phải Được, trái Lại, lên Dễ, xuống Khó."
        data-testid="flashcard"
      >
        <div
          className={`h-full w-full cursor-grab active:cursor-grabbing motion-reduce:transition-none ${
            dragging ? '' : 'transition-transform duration-200 ease-out'
          } ${leaving ? 'opacity-0 transition-opacity duration-200' : ''}`}
          style={{ transform: `translate(${drag.x}px, ${drag.y}px) rotate(${tilt}deg)` }}
        >
          <FlashcardFace card={card} flipped={flipped} loadAudio={loadAudio} />
          {heading ? (
            <div
              className={`pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl text-3xl font-bold ${HINTS[heading].className}`}
              aria-hidden="true"
            >
              {HINTS[heading].label}
            </div>
          ) : null}
        </div>
      </div>

      <p className="text-muted-foreground min-h-5 text-center text-sm" aria-live="polite">
        {flipped
          ? 'Vuốt phải: Được · trái: Lại · lên: Dễ · xuống: Khó'
          : nudge
            ? 'Lật thẻ trước rồi mới chấm nhé.'
            : 'Nghĩ câu trả lời trước, rồi lật thẻ.'}
      </p>

      <div className="grid grid-cols-4 gap-2">
        {BUTTONS.map(({ rating, icon: Icon }) => (
          <button
            key={rating}
            type="button"
            disabled={!flipped || submitting || leaving !== null}
            onClick={() => rate(rating)}
            className="border-input bg-background hover:bg-muted focus-visible:ring-ring flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon className="size-4" aria-hidden="true" />
            {HINTS[rating].label}
          </button>
        ))}
      </div>
    </div>
  );
}
