import { isLanguageCode, SUPPORTED_LANGUAGES } from '@cuelingo/shared';
import type { TranscriptEvent } from '../lib/native';
import { splitParts } from '@cuelingo/ui/lib/text-units';

interface CaptionBlockProps {
  segment: TranscriptEvent;
  level: number;
  /** Older blocks recede so the current sentence is the one the eye lands on. */
  faded: boolean;
  /** Show who is speaking above the block. */
  showSpeaker: boolean;
  onLookup(term: string): void;
}

function OriginalText({
  text,
  language,
  lookup,
  onLookup,
}: {
  text: string;
  language: string;
  lookup: boolean;
  onLookup(term: string): void;
}) {
  if (!lookup) return <>{text}</>;
  return (
    <>
      {splitParts(text, language).map(({ text: part, isWord }, index) =>
        isWord ? (
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

/** One sentence of the meeting: the spoken language on top, the Vietnamese rendering under it. */
export function CaptionBlock({ segment, level, faded, showSpeaker, onLookup }: CaptionBlockProps) {
  const mine = segment.stream === 'mic';
  // A language that is not translated (Vietnamese) has only its own text: always show it, never wait for a translation.
  const code = segment.language ?? 'en';
  const translates = isLanguageCode(code) ? SUPPORTED_LANGUAGES[code].translates : true;
  const showEnglish = level !== 1 || !translates;
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
          <OriginalText
            text={segment.text}
            language={segment.language ?? 'en'}
            lookup={!mine}
            onLookup={onLookup}
          />
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
      ) : segment.partial || mine || !translates ? null : (
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
