/**
 * Shapes of the cards the assistant shows. `@cuelingo/ui` does not depend on `@cuelingo/shared`, so these
 * mirror `AgentCard` structurally; the API validates the real schema before a card ever reaches here.
 */
export type AgentCardLike =
  | { kind: 'flashcards'; data: { title?: string; cards: Array<{ front: string; back: string }> } }
  | {
      kind: 'cloze';
      data: {
        title?: string;
        items: Array<{ sentence: string; answer: string; hint?: string }>;
      };
    }
  | {
      kind: 'quiz_choice';
      data: { question: string; options: string[]; answerIndex: number; explanation?: string };
    }
  | { kind: 'compare_table'; data: { title?: string; columns: string[]; rows: string[][] } }
  | {
      kind: 'phrase_list';
      data: {
        title?: string;
        items: Array<{ phrase: string; meaningVi?: string; example?: string }>;
      };
    }
  /** Layer 2 (ADR 0019): a page for the sandbox runner. Drawn only through `renderHtmlBlock`, never inline. */
  | { kind: 'html_block'; data: { title?: string; html: string } };

const normalizeAnswer = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

/** Whether what the person typed is the expected answer: case, spacing and a final full stop do not count. */
export function isClozeCorrect(typed: string, answer: string): boolean {
  const clean = (text: string) => normalizeAnswer(text).replace(/[.!?]+$/, '');
  return clean(typed) !== '' && clean(typed) === clean(answer);
}

/** The sentence cut at its blank: text before, text after. */
export function splitCloze(sentence: string): [string, string] {
  const at = sentence.indexOf('___');
  return at === -1 ? [sentence, ''] : [sentence.slice(0, at), sentence.slice(at + 3)];
}
