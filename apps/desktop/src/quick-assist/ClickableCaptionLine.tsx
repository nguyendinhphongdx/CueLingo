import { CaptionLine } from '@cuelingo/ui/components/caption-line';

interface ClickableCaptionLineProps {
  text: string;
  translation?: string;
  partial?: boolean;
  lookupEnabled?: boolean;
  className?: string;
  onLookup(term: string): void;
}

const WORD_PATTERN = /([\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*)/gu;
const WORD_ONLY_PATTERN = /^[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*$/u;

export function splitCaptionWords(text: string) {
  return text.split(WORD_PATTERN).filter(Boolean);
}

export function ClickableCaptionLine({
  text,
  translation,
  partial = false,
  lookupEnabled = true,
  className,
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
        {splitCaptionWords(text).map((part, index) =>
          WORD_ONLY_PATTERN.test(part) ? (
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
