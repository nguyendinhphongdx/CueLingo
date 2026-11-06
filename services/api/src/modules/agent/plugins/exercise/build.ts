import type { AgentCard } from '@cuelingo/shared';

export type ExerciseKind = 'cloze' | 'quiz_choice';
export interface SavedPhrase {
  phrase: string;
  meaningVi: string | null;
}

/** Most items one exercise holds; the card schema allows 10 cloze items, the model needs a handful. */
export const MAX_ITEMS = 5;
const BLANK = '___';
const MIN_WORD = 4;

type Built = { card: AgentCard } | { problem: string };

const WORD = /[A-Za-z][A-Za-z'-]*/g;

/** Cuts text into sentences on `.`, `!`, `?` and line breaks. */
const sentencesOf = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

/** The word of a sentence worth hiding: the longest one, the first on a tie. `undefined` if all are short. */
function pickWord(sentence: string): string | undefined {
  let best: string | undefined;
  for (const word of sentence.match(WORD) ?? []) {
    if (word.length >= MIN_WORD && (!best || word.length > best.length)) best = word;
  }
  return best;
}

const blankOut = (sentence: string, word: string): string => {
  const at = sentence.indexOf(word);
  return `${sentence.slice(0, at)}${BLANK}${sentence.slice(at + word.length)}`;
};

/** A fixed rotation instead of a random shuffle, so the same input always gives the same card. */
function placeAnswer(
  answer: string,
  others: string[],
  seed: number,
): { options: string[]; answerIndex: number } {
  const options = [...others];
  const answerIndex = seed % (options.length + 1);
  options.splice(answerIndex, 0, answer);
  return { options, answerIndex };
}

const unique = (words: string[]): string[] => {
  const seen = new Set<string>();
  return words.filter((w) => {
    const key = w.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** Exercise from phrases the user saved. Only phrases with a Vietnamese meaning can be asked about. */
export function fromPhrases(kind: ExerciseKind, phrases: SavedPhrase[], count: number): Built {
  const usable = phrases.filter((p): p is { phrase: string; meaningVi: string } =>
    Boolean(p.meaningVi?.trim()),
  );
  if (kind === 'cloze') {
    const items = usable.slice(0, count).map((p) => ({
      sentence: `${BLANK}: ${p.meaningVi}`.slice(0, 300),
      answer: p.phrase.slice(0, 80),
      hint: 'Viết cụm từ tiếng Anh có nghĩa này',
    }));
    if (items.length === 0) return { problem: 'Chưa có cụm từ đã lưu kèm nghĩa để tạo bài tập.' };
    return { card: { kind: 'cloze', data: { title: 'Điền từ đã lưu', items } } };
  }
  // A choice question needs wrong answers too, taken from the user's other phrases.
  if (usable.length < 3) {
    return { problem: 'Cần ít nhất 3 cụm từ đã lưu kèm nghĩa để tạo câu trắc nghiệm.' };
  }
  const index = 0;
  const target = usable[index]!;
  const others = usable.slice(1, 4).map((p) => p.phrase);
  const { options, answerIndex } = placeAnswer(target.phrase, others, target.phrase.length);
  return {
    card: {
      kind: 'quiz_choice',
      data: {
        question: `“${target.meaningVi}” trong tiếng Anh là gì?`.slice(0, 400),
        options: options.map((o) => o.slice(0, 120)),
        answerIndex,
      },
    },
  };
}

/** Exercise from text the user gave: hide one long word per sentence. */
export function fromText(kind: ExerciseKind, text: string, count: number): Built {
  const picks = sentencesOf(text)
    .map((sentence) => ({ sentence, word: pickWord(sentence) }))
    .filter(
      (p): p is { sentence: string; word: string } => Boolean(p.word) && p.sentence.length <= 300,
    );
  if (picks.length === 0) {
    return { problem: 'Đoạn văn quá ngắn hoặc không có từ đủ dài để tạo bài tập.' };
  }
  if (kind === 'cloze') {
    return {
      card: {
        kind: 'cloze',
        data: {
          title: 'Điền từ vào chỗ trống',
          items: picks.slice(0, count).map((p) => ({
            sentence: blankOut(p.sentence, p.word),
            answer: p.word.slice(0, 80),
          })),
        },
      },
    };
  }
  const first = picks[0]!;
  const pool = unique(
    sentencesOf(text).flatMap((s) => (s.match(WORD) ?? []).filter((w) => w.length >= MIN_WORD)),
  );
  const distractors = pool.filter((w) => w.toLowerCase() !== first.word.toLowerCase()).slice(0, 3);
  if (distractors.length < 1)
    return { problem: 'Đoạn văn không đủ từ khác nhau để tạo câu trắc nghiệm.' };
  const { options, answerIndex } = placeAnswer(first.word, distractors, first.word.length);
  return {
    card: {
      kind: 'quiz_choice',
      data: {
        question: `Từ nào điền vào chỗ trống? “${blankOut(first.sentence, first.word)}”`.slice(
          0,
          400,
        ),
        options,
        answerIndex,
      },
    },
  };
}
