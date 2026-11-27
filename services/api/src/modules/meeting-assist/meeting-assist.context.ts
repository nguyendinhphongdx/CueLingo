import type { MeetingAskPromptInput } from '@cuelingo/prompts';
import { meetingAskRefs } from '@cuelingo/prompts';
import type {
  AskMeetingRequest,
  GlossaryTerm,
  LanguageCode,
  MeetingAnswerSource,
  Phrase,
  SessionDetail,
} from '@cuelingo/shared';
import { speakerName, type MeetingAssistRepository } from './meeting-assist.repository';
import {
  capPast,
  hasPastWords,
  keywords,
  matchTerms,
  rankPast,
  selectCurrent,
  type RankedMeeting,
} from './retrieval';

const PAST_DAYS = 180;
const HISTORY_QUESTIONS = 3;
const HISTORY_ANSWER_CHARS = 600;

export interface ContextSources {
  repo: Pick<MeetingAssistRepository, 'recentAnswers' | 'searchPast' | 'linesAround'>;
  listGlossary(userId: string, language: LanguageCode): Promise<GlossaryTerm[]>;
  listPhrases(userId: string, language: LanguageCode): Promise<Phrase[]>;
  now: () => Date;
}

export interface MeetingContext {
  input: MeetingAskPromptInput;
  /** `available[n - 1]` is what source `[n]` of the prompt stands for. */
  available: MeetingAnswerSource[];
  /** Earlier meetings could not be searched; the answer goes on without them. */
  pastFailed: boolean;
}

/** Gathers, by fixed rules, what of this person's data goes with the question. */
export async function buildContext(
  sources: ContextSources,
  userId: string,
  meeting: SessionDetail,
  request: AskMeetingRequest,
): Promise<MeetingContext> {
  const pointed = request.focus?.segmentId
    ? meeting.segments.find((segment) => segment.id === request.focus!.segmentId)
    : undefined;
  const focus = pointed?.textEn ?? request.focus?.text;
  const asked = [request.question, focus ?? ''].join('\n');
  const keys = keywords(asked);

  const lines = meeting.segments.map((segment) => {
    const speaker = meeting.speakers.find((item) => item.id === segment.speakerId);
    return `${speakerName({
      displayName: speaker?.displayName ?? null,
      label: speaker?.label ?? null,
      source: segment.source,
    })}: ${segment.textEn}`;
  });
  const current = selectCurrent(lines, keys);
  const haystack = [asked, ...current].join('\n');

  // A glossary is kept per language; English terms show up in meetings held in any language.
  const glossaryLanguages = [...new Set<LanguageCode>([meeting.language, 'en'])];
  const [glossary, phrases, history, past] = await Promise.all([
    Promise.all(glossaryLanguages.map((language) => sources.listGlossary(userId, language))),
    sources.listPhrases(userId, meeting.language),
    sources.repo.recentAnswers(userId, meeting.id, HISTORY_QUESTIONS),
    searchEarlier(sources, userId, meeting.id, keys, asked).catch(() => null),
  ]);

  const input: MeetingAskPromptInput = {
    language: meeting.language,
    question: request.question,
    ...(request.detail ? { detail: true } : {}),
    ...(focus ? { focus } : {}),
    current,
    glossary: matchTerms(glossary.flat(), (term) => term.term, haystack).map((term) => ({
      term: term.term,
      ...(term.translation ? { translation: term.translation } : {}),
      ...(term.note ? { note: term.note } : {}),
    })),
    phrases: matchTerms(phrases, (item) => item.phrase, haystack).map((item) => ({
      phrase: item.phrase,
      ...(item.meaningVi ? { meaningVi: item.meaningVi } : {}),
    })),
    past: (past ?? []).map(({ session, lines: found }) => ({
      title: session.title ?? 'Untitled meeting',
      date: session.startedAt.slice(0, 10),
      ...(session.headline ? { headline: session.headline } : {}),
      lines: found,
    })),
    history: history.map(({ question, answer }) => ({
      question,
      answer: answer.slice(0, HISTORY_ANSWER_CHARS),
    })),
  };

  const available = meetingAskRefs(input).map((ref): MeetingAnswerSource => {
    if (ref.kind !== 'past_meeting') return { kind: ref.kind };
    const { session } = past![ref.past]!;
    return {
      kind: 'past_meeting',
      sessionId: session.id,
      title: session.title,
      startedAt: session.startedAt,
    };
  });
  return { input, available, pastFailed: past === null };
}

async function searchEarlier(
  sources: ContextSources,
  userId: string,
  currentSessionId: string,
  keys: string[],
  asked: string,
): Promise<Array<{ session: RankedMeeting['session']; lines: string[] }> | null> {
  const since = new Date(sources.now().getTime() - PAST_DAYS * 86_400_000);
  const found = await sources.repo.searchPast(userId, {
    excludeSessionId: currentSessionId,
    keywords: keys,
    since,
  });
  if (found.timedOut) return null;
  const ranked = rankPast(found.sessions, found.hits, keys, hasPastWords(asked));
  const lines = await Promise.all(
    ranked.map(async ({ session, segmentIds }) =>
      (await sources.repo.linesAround(userId, session.id, segmentIds)).map(
        (line) => `${line.speaker}: ${line.text}`,
      ),
    ),
  );
  const capped = capPast(lines);
  return ranked.map(({ session }, index) => ({ session, lines: capped[index]! }));
}
