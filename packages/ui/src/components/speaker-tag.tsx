import { cn } from '../lib/utils';
import { speakerDisplayName, speakerNumber, type SpeakerLike } from '../lib/speaker';

/** Soft, stable colour per speaker number; the name is always printed, colour only helps scanning. */
const TONES = [
  'bg-primary/10 text-primary border-primary/30',
  'bg-accent text-accent-foreground border-accent-foreground/20',
  'bg-secondary text-secondary-foreground border-secondary-foreground/20',
  'bg-muted text-foreground border-foreground/20',
] as const;

const ME_TONE = 'bg-foreground text-background border-foreground';
const OTHER_TONE = 'bg-muted text-muted-foreground border-border';

const toneOf = (label: string | null | undefined, isMe: boolean): string => {
  if (isMe) return ME_TONE;
  const number = speakerNumber(label);
  return number === null ? OTHER_TONE : TONES[(number - 1) % TONES.length]!;
};

export interface SpeakerTagProps extends SpeakerLike {
  /** When given, the tag is a button that asks the client to rename this speaker. */
  onRename?: () => void;
  className?: string;
}

/** Who said a sentence: the one tag used by the overlay and the web transcript. */
export function SpeakerTag({ label, displayName, source, onRename, className }: SpeakerTagProps) {
  const name = speakerDisplayName({ label, displayName, source });
  const classes = cn(
    'inline-flex max-w-40 items-center truncate rounded-full border px-2 py-0.5 text-xs font-medium',
    toneOf(label, name === 'Tôi'),
    className,
  );
  return onRename ? (
    <button
      type="button"
      data-slot="speaker-tag"
      title="Đổi tên người nói"
      aria-label={`${name}, đổi tên người nói`}
      onClick={onRename}
      className={cn(classes, 'focus-visible:ring-ring cursor-pointer focus-visible:ring-2')}
    >
      {name}
    </button>
  ) : (
    <span data-slot="speaker-tag" className={classes}>
      {name}
    </span>
  );
}
