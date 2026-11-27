import { randomUUID } from 'node:crypto';
import type { DebriefRepository } from '../debrief';
import type { SessionsRepository } from '../sessions';
import {
  debriefText,
  PAST_SESSION_LIMIT,
  speakerName,
  type FinishQuestionInput,
  type MeetingAssistRepository,
  type PastHit,
  type PastSession,
} from './meeting-assist.repository';

export interface StoredQuestion extends Omit<FinishQuestionInput, 'status'> {
  id: string;
  userId: string;
  sessionId: string;
  question: string;
  promptVersion: string;
  status: FinishQuestionInput['status'] | 'streaming';
}

export type InMemoryMeetingAssistRepository = MeetingAssistRepository & {
  questions: StoredQuestion[];
};

/** In-memory store for tests; meetings are read through the sessions and debrief stores. */
export function createInMemoryMeetingAssistRepository(deps: {
  sessions: SessionsRepository;
  debrief: DebriefRepository;
}): InMemoryMeetingAssistRepository {
  const consents = new Map<string, string>();
  const questions: StoredQuestion[] = [];

  return {
    questions,
    async consentVersion(userId) {
      return consents.get(userId) ?? null;
    },
    async grantConsent(userId, version) {
      consents.set(userId, version);
    },
    async revokeConsent(userId) {
      consents.delete(userId);
    },
    async createQuestion(userId, sessionId, { question, promptVersion }) {
      if (!(await deps.sessions.findById(userId, sessionId))) return null;
      const id = randomUUID();
      questions.push({
        id,
        userId,
        sessionId,
        question,
        promptVersion,
        answer: '',
        sources: [],
        status: 'streaming',
      });
      return id;
    },
    async finishQuestion(userId, id, input) {
      const row = questions.find((item) => item.id === id && item.userId === userId);
      if (row) Object.assign(row, input);
    },
    async recentAnswers(userId, sessionId, limit) {
      return questions
        .filter(
          (row) =>
            row.userId === userId &&
            row.sessionId === sessionId &&
            (row.status === 'complete' || row.status === 'stopped') &&
            row.answer !== '',
        )
        .slice(-limit)
        .map(({ question, answer }) => ({ question, answer }));
    },
    async searchPast(userId, { excludeSessionId, keywords, since }) {
      if (keywords.length === 0) return { sessions: [], hits: [] };
      const recent = (await deps.sessions.list(userId))
        .filter((row) => row.id !== excludeSessionId && new Date(row.startedAt) >= since)
        .slice(0, PAST_SESSION_LIMIT);
      const sessions: PastSession[] = [];
      const hits: PastHit[] = [];
      for (const row of recent) {
        const debrief = await deps.debrief.findLatest(userId, row.id);
        sessions.push({
          id: row.id,
          title: row.title,
          startedAt: row.startedAt,
          headline: debrief?.summary.headlineVi ?? null,
          debriefText: debrief ? debriefText(debrief) : '',
        });
        for (const segment of (await deps.sessions.findDetail(userId, row.id))?.segments ?? []) {
          const text = `${segment.textEn}\n${segment.textVi ?? ''}`.toLowerCase();
          if (!keywords.some((keyword) => text.includes(keyword))) continue;
          hits.push({
            sessionId: row.id,
            segmentId: segment.id,
            text: segment.textEn,
            translation: segment.textVi,
          });
        }
      }
      return { sessions, hits };
    },
    async linesAround(userId, sessionId, segmentIds) {
      const detail = await deps.sessions.findDetail(userId, sessionId);
      if (!detail) return [];
      const wanted = new Set<number>();
      detail.segments.forEach((segment, index) => {
        if (segmentIds.includes(segment.id)) {
          for (const near of [index - 1, index, index + 1]) wanted.add(near);
        }
      });
      return detail.segments
        .filter((_, index) => wanted.has(index))
        .map((segment) => {
          const speaker = detail.speakers.find((item) => item.id === segment.speakerId);
          return {
            speaker: speakerName({
              displayName: speaker?.displayName ?? null,
              label: speaker?.label ?? null,
              source: segment.source,
            }),
            text: segment.textEn,
          };
        });
    },
  };
}
