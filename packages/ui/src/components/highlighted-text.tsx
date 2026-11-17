import { highlight } from '../lib/meeting-search';

/** `text` with the parts equal to `query` marked (ignoring case), for search results in every client. */
export function HighlightedText({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlight(text, query).map((part, index) =>
        part.match ? (
          <mark key={index} className="bg-warning/20 text-foreground rounded-sm px-0.5">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}
