import type { GlossaryTerm } from '@cuelingo/shared';

/** Most terms taken from one paste, so a wrong paste cannot fire hundreds of requests. */
export const MAX_BULK_TERMS = 50;
const MAX_TERM = 120;
const MAX_TRANSLATION = 200;

export interface BulkEntry {
  term: string;
  translation: string | null;
}

export interface BulkParse {
  entries: BulkEntry[];
  /** Lines left out: too long, duplicated in the paste or already in the list. */
  skipped: number;
  /** Lines past the limit of {@link MAX_BULK_TERMS}. */
  overLimit: number;
}

/** A tab, ` - `, ` – `, ` — `, `|`, `=` or `;` splits a term from its translation. */
const SEPARATOR = /\t| [-–—] |\||=|;/u;

/** One term per line, optionally followed by its translation. */
export function parseBulkTerms(
  text: string,
  existing: Pick<GlossaryTerm, 'term'>[] = [],
): BulkParse {
  const seen = new Set(existing.map((item) => item.term.trim().toLowerCase()));
  const entries: BulkEntry[] = [];
  let skipped = 0;
  let overLimit = 0;
  for (const line of text.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    const [rawTerm = '', ...rest] = line.split(SEPARATOR);
    const term = rawTerm.trim();
    const translation = rest.join(' ').trim() || null;
    const key = term.toLowerCase();
    if (
      !term ||
      term.length > MAX_TERM ||
      (translation?.length ?? 0) > MAX_TRANSLATION ||
      seen.has(key)
    ) {
      skipped += 1;
      continue;
    }
    if (entries.length >= MAX_BULK_TERMS) {
      overLimit += 1;
      continue;
    }
    seen.add(key);
    entries.push({ term, translation });
  }
  return { entries, skipped, overLimit };
}
