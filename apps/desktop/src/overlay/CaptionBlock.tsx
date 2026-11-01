import type { TranscriptEvent } from '../lib/native';
import { splitCaptionWords } from '../quick-assist';

const WORD_ONLY = /^[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*$/u;

interface CaptionBlockProps {
  segment: TranscriptEvent;
  level: number;
  /** Older blocks recede so the current sentence is the one the eye lands on. */
  faded: boolean;
  /** Show who is speaking above the block. */
  showSpeaker: boolean;
  onLookup(term: string): void;
}

function EnglishText({
  text,
  lookup,
  onLookup,
}: {
  text: string;
  lookup: boolean;
  onLookup(term: string): void;
}) {
  if (!lookup) return <>{text}</>;
  return (
    <>
      {splitCaptionWords(text).map((part, index) =>
        WORD_ONLY.test(part) ? (
          <button
            key={`${index}-${part}`}
            type="button"
            aria-label={`Tra từ ${part}`}
            title="Bấm để tra từ"
            onClick={() => onLookup(part)}
            className="hover:bg-primary/15 focus-visible:ring-ring cursor-pointer rounded-sm px-px text-inherit transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {part}
          </button>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** One sentence of the meeting: English on top, the Vietnamese rendering under it. */
export function CaptionBlock({ segment, level, faded, showSpeaker, onLookup }: CaptionBlockProps) {
  const mine = segment.stream === 'mic';
  const showEnglish = level !== 1;
  const translation = segment.translation;

  return (
    <div
      data-slot="caption-line"
      data-partial={segment.partial ? 'true' : undefined}
      className={`transition-opacity duration-300 ${faded ? 'opacity-50' : ''}`}
    >
      {showSpeaker ? (
        <p className="text-muted-foreground mb-1 text-[0.7em] font-medium">{mine ? 'Tôi' : 'Họ'}</p>
      ) : null}
      {showEnglish ? (
        <p
          data-role="original"
          className={`text-muted-foreground leading-snug ${segment.partial ? 'opacity-70' : ''}`}
          style={{ fontSize: '0.86em' }}
        >
          <EnglishText text={segment.text} lookup={!mine} onLookup={onLookup} />
          {segment.partial ? (
            <span
              aria-hidden="true"
              className="bg-primary ml-1 inline-block h-[0.9em] w-0.5 translate-y-[0.12em] animate-pulse rounded-full"
            />
          ) : null}
        </p>
      ) : null}
      {translation ? (
        <p
          data-role="translation"
          className="text-foreground mt-0.5 leading-snug font-semibold"
          style={{ fontSize: '1.08em' }}
        >
          {translation}
        </p>
      ) : segment.partial || mine ? null : (
        <p
          data-role="translation"
          className="text-muted-foreground mt-0.5 animate-pulse text-[0.9em]"
        >
          Đang dịch…
        </p>
      )}
    </div>
  );
}
