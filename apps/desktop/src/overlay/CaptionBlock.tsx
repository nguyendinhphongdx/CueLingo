import { isLanguageCode, SUPPORTED_LANGUAGES } from '@cuelingo/shared';
import type { TranscriptEvent } from '../lib/native';
import { splitParts } from '@cuelingo/ui/lib/text-units';
import { SpeakerTag } from '@cuelingo/ui/components/speaker-tag';
import { Badge } from '@cuelingo/ui/components/badge';

interface CaptionBlockProps {
  segment: TranscriptEvent;
  level: number;
  /** Older blocks recede so the current sentence is the one the eye lands on. */
  faded: boolean;
  /** Show who is speaking above the block. */
  showSpeaker: boolean;
  onLookup(term: string): void;
  /** Asks the assistant about this sentence; no button when the assistant is not available. */
  onExplain?(): void;
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
export function CaptionBlock({
  segment,
  level,
  faded,
  showSpeaker,
  onLookup,
  onExplain,
}: CaptionBlockProps) {
  const mine = segment.stream === 'mic';
  // A language that is not translated (Vietnamese) has only its own text: always show it, never wait for a translation.
  const code = segment.language ?? 'en';
  const translates = isLanguageCode(code) ? SUPPORTED_LANGUAGES[code].translates : true;
  // Word lookup needs a learnable language: the lookup prompt has nothing to say about Vietnamese.
  const learnable = isLanguageCode(code) ? SUPPORTED_LANGUAGES[code].learnable : true;
  const showEnglish = level !== 1 || !translates;
  const translation = segment.translation;

  return (
    <div
      data-slot="caption-line"
      data-partial={segment.partial ? 'true' : undefined}
      // The app turns text selection off for its chrome; the words of the meeting must stay copyable.
      className={`group cursor-text transition-opacity duration-300 select-text ${faded ? 'opacity-70' : ''}`}
    >
      {showSpeaker ? (
        <p className="mb-1 text-[0.7em]">
          <SpeakerTag label={segment.speaker} source={mine ? 'mic' : 'system'} />
        </p>
      ) : null}
      {segment.offline && !segment.partial ? (
        <p className="mb-1 text-[0.7em]">
          <Badge
            variant="warning"
            title="Nhận dạng trên máy vì đám mây không dùng được; không gửi âm thanh đi, có thể kém chính xác hơn"
          >
            Ngoại tuyến
          </Badge>
        </p>
      ) : null}
      {showEnglish ? (
        <p
          data-role="original"
          // Caption text is pure black or white and never follows the background opacity; the pulsing caret marks the unfinished line.
          className="text-caption-text leading-snug"
          style={{ fontSize: '0.86em' }}
        >
          <OriginalText
            text={segment.text}
            language={segment.language ?? 'en'}
            lookup={!mine && learnable}
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
          className="text-translation mt-0.5 leading-snug font-semibold"
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
      {onExplain && !segment.partial ? (
        <button
          type="button"
          onClick={onExplain}
          // Out of the way until the person points at the sentence or tabs to it.
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-0.5 cursor-pointer rounded-md px-1 text-xs font-medium opacity-0 select-none group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
        >
          Giải thích
        </button>
      ) : null}
    </div>
  );
}
