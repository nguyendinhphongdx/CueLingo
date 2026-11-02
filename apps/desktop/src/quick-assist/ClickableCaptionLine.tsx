import { CaptionLine } from '@cuelingo/ui/components/caption-line';
import { splitParts } from '@cuelingo/ui/lib/text-units';

interface ClickableCaptionLineProps {
  text: string;
  translation?: string;
  partial?: boolean;
  lookupEnabled?: boolean;
  className?: string;
  /** Language of `text`; decides where one word ends and the next begins. */
  language?: string;
  onLookup(term: string): void;
}

/** The pieces of a caption, as plain strings; use `splitParts` when you need to know which are words. */
export function splitCaptionWords(text: string, language = 'en') {
  return splitParts(text, language).map((part) => part.text);
}

export function ClickableCaptionLine({
  text,
  translation,
  partial = false,
  lookupEnabled = true,
  className,
  language = 'en',
  onLookup,
}: ClickableCaptionLineProps) {
  if (!lookupEnabled) {
    return (
      <CaptionLine text={text} translation={translation} partial={partial} className={className} />
    );
  }

  return (
    <div
      data-slot="caption-line"
      data-partial={partial ? 'true' : undefined}
      className={`text-foreground transition-opacity ${partial ? 'opacity-60' : ''} ${className ?? ''}`}
    >
      <p>
        {splitParts(text, language).map(({ text: part, isWord }, index) =>
          isWord ? (
            <button
              key={`${index}-${part}`}
              type="button"
              aria-label={`Tra từ ${part}`}
              className="focus-visible:ring-ring inline-flex min-h-11 cursor-pointer items-center rounded-sm px-0.5 text-inherit underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => onLookup(part)}
            >
              {part}
            </button>
          ) : (
            part
          ),
        )}
      </p>
      {translation ? <p className="mt-1 text-sm opacity-80">{translation}</p> : null}
    </div>
  );
}
