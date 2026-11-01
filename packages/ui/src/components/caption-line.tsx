import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export interface CaptionLineProps {
  text: string;
  translation?: string;
  hardWords?: string[];
  partial?: boolean;
  className?: string;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightHardWords(text: string, hardWords: string[]): ReactNode[] {
  const phrases = Array.from(
    new Map(
      hardWords
        .map((phrase) => phrase.trim())
        .filter(Boolean)
        .map((phrase) => [phrase.toLocaleLowerCase(), phrase]),
    ).values(),
  ).sort((left, right) => right.length - left.length);

  if (phrases.length === 0) {
    return [text];
  }

  const pattern = new RegExp(phrases.map(escapeRegExp).join('|'), 'giu');
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index;

    if (start > cursor) {
      parts.push(text.slice(cursor, start));
    }

    parts.push(<u key={`${start}-${match[0]}`}>{match[0]}</u>);
    cursor = start + match[0].length;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts.length > 0 ? parts : [text];
}

function CaptionLine({
  text,
  translation,
  hardWords = [],
  partial = false,
  className,
}: CaptionLineProps) {
  return (
    <div
      data-slot="caption-line"
      data-partial={partial ? 'true' : undefined}
      className={cn('text-foreground transition-opacity', partial && 'opacity-60', className)}
    >
      <p>{highlightHardWords(text, hardWords)}</p>
      {translation ? <p className="text-muted-foreground mt-1 text-sm">{translation}</p> : null}
    </div>
  );
}

export { CaptionLine };
