/**
 * Pure rules that decide what goes into a meeting question (ADR 0027): no I/O, no AI call. Budgets are in
 * characters, about four per token.
 */
import type { PastHit, PastSession } from './meeting-assist.repository';

const KEYWORD_LIMIT = 8;
const CURRENT_TAIL_CHARS = 10_000;
const CURRENT_OLDER_CHARS = 4_000;
const PAST_CHARS = 4_000;
const PAST_MEETINGS = 3;
const PAST_HITS_PER_MEETING = 4;
const TERM_LIMIT = 20;
const TERM_CHARS = 1_600;

const STOPWORDS = new Set(
  (
    'the and for are was were you your our their this that these those with from have has had will would can ' +
    'could should about what which when where who whom why how did does done been being into over than then ' +
    'them they there here not but any all its his her she him let say said tell more last time previous meeting ' +
    'là và của có cho với các những một này kia đó đấy gì nào sao thế nào được bị đã đang sẽ rồi chưa không ' +
    'chẳng cũng vẫn còn lại thì mà nên vì do bởi tại từ đến trong ngoài trên dưới về ra vào lên xuống hay hoặc ' +
    'nhưng nếu khi lúc đâu ai bao nhiêu mấy lần trước hôm sau bàn nói việc chuyện cuộc họp mình tôi anh chị em ' +
    'bạn họ chúng ta ơi nhé ạ vậy à ừ giải thích nghĩa câu cuối'
  ).split(' '),
);

/** Words that say the person is asking about an earlier meeting. */
const PAST_WORDS = [
  'lần trước',
  'hôm trước',
  'bữa trước',
  'tuần trước',
  'cuộc trước',
  'last time',
  'previous',
  'last week',
  'last meeting',
  '前回',
  '上次',
  '지난번',
];

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu;
const VIETNAMESE_MARK = /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/;

export const normalise = (text: string): string => text.normalize('NFC').toLowerCase();

export const hasPastWords = (text: string): boolean => {
  const value = normalise(text);
  return PAST_WORDS.some((word) => value.includes(word));
};

/**
 * Up to eight search keys of a text. Vietnamese words are mostly two syllables, so adjacent syllables are kept
 * as a pair; Chinese, Japanese and Korean have no spaces, so runs are cut into character pairs.
 */
export function keywords(text: string): string[] {
  const value = normalise(text);
  const found = new Set<string>();
  for (const [run] of value.matchAll(CJK)) {
    const chars = [...run];
    // Two kana on their own are mostly grammar (です, ます, した): keep pairs that carry a Han or Hangul letter,
    // and katakana pairs (borrowed words and names).
    for (let i = 0; i + 1 < chars.length; i += 1) {
      const pair = chars[i]! + chars[i + 1]!;
      if (!/^\p{Script=Hiragana}+$/u.test(pair)) found.add(pair);
    }
  }
  const vietnamese = VIETNAMESE_MARK.test(value);
  // Phrases are split at punctuation, so a pair never joins the end of one clause to the start of the next.
  for (const clause of value.replace(CJK, ' ').split(/[.,;:!?()[\]{}"“”\n]+/)) {
    const tokens = clause.match(/[\p{L}\p{M}\p{N}_%\\-]+/gu) ?? [];
    tokens.forEach((token, index) => {
      if (STOPWORDS.has(token)) return;
      const marked = VIETNAMESE_MARK.test(token);
      if (!marked && token.length >= 3) found.add(token);
      const next = tokens[index + 1];
      if (vietnamese && next && !STOPWORDS.has(next) && (marked || VIETNAMESE_MARK.test(next))) {
        found.add(`${token} ${next}`);
      }
    });
  }
  return [...found].slice(0, KEYWORD_LIMIT);
}

/** How many different keys appear in a text. */
export function score(text: string, keys: string[]): number {
  const value = normalise(text);
  return keys.filter((key) => value.includes(key)).length;
}

/**
 * What is sent of the running meeting: the latest lines, plus older lines that mention a key (each with its
 * neighbours). Order is kept.
 */
export function selectCurrent(lines: string[], keys: string[]): string[] {
  const picked = new Set<number>();
  let tail = 0;
  let start = lines.length;
  while (start > 0 && tail + lines[start - 1]!.length <= CURRENT_TAIL_CHARS) {
    start -= 1;
    tail += lines[start]!.length;
    picked.add(start);
  }
  const matches = lines
    .slice(0, start)
    .map((line, index) => ({ index, score: score(line, keys) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || b.index - a.index);
  let older = 0;
  for (const { index } of matches) {
    for (const near of [index - 1, index, index + 1]) {
      if (near < 0 || near >= start || picked.has(near)) continue;
      if (older + lines[near]!.length > CURRENT_OLDER_CHARS) continue;
      older += lines[near]!.length;
      picked.add(near);
    }
  }
  return [...picked].sort((a, b) => a - b).map((index) => lines[index]!);
}

/** Saved terms that really occur in what is being talked about; nothing else of the glossary is sent. */
export function matchTerms<T>(items: T[], textOf: (item: T) => string, haystack: string): T[] {
  const value = normalise(haystack);
  const out: T[] = [];
  let chars = 0;
  for (const item of items) {
    const term = normalise(textOf(item)).trim();
    if (term.length < 2 || !value.includes(term)) continue;
    if (out.length >= TERM_LIMIT) break;
    const size = JSON.stringify(item).length;
    // One long note must not push out the short terms after it.
    if (chars + size > TERM_CHARS) continue;
    chars += size;
    out.push(item);
  }
  return out;
}

export interface RankedMeeting {
  session: PastSession;
  segmentIds: string[];
}

/**
 * At most three earlier meetings worth reading. A meeting needs two different keys, or one when the question
 * itself points at the past; ties go to the newer meeting.
 */
export function rankPast(
  sessions: PastSession[],
  hits: PastHit[],
  keys: string[],
  asksAboutPast: boolean,
): RankedMeeting[] {
  const needed = asksAboutPast ? 1 : 2;
  return sessions
    .map((session) => {
      const own = hits.filter((hit) => hit.sessionId === session.id);
      const text = [
        session.title ?? '',
        session.debriefText,
        ...own.map((hit) => `${hit.text} ${hit.translation ?? ''}`),
      ].join('\n');
      const segmentIds = own
        .map((hit) => ({ id: hit.segmentId, score: score(`${hit.text} ${hit.translation}`, keys) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, PAST_HITS_PER_MEETING)
        .map((hit) => hit.id);
      return { session, segmentIds, score: score(text, keys) };
    })
    .filter((meeting) => meeting.score >= needed)
    .sort((a, b) => b.score - a.score || b.session.startedAt.localeCompare(a.session.startedAt))
    .slice(0, PAST_MEETINGS)
    .map(({ session, segmentIds }) => ({ session, segmentIds }));
}

/** Cuts the lines of the earlier meetings so that together they stay in their budget. */
export function capPast(linesPerMeeting: string[][]): string[][] {
  const share = Math.floor(PAST_CHARS / Math.max(linesPerMeeting.length, 1));
  return linesPerMeeting.map((lines) => {
    let chars = 0;
    return lines.filter((line) => (chars += line.length) <= share);
  });
}
