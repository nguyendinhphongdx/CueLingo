import type { LanguageCode } from '@cuelingo/shared';
import type { InMemoryDebriefRepository } from '../debrief';
import type { GlossaryRepository } from '../glossary';
import type { SessionsRepository } from '../sessions';
import type { CourseLog, CoursesRepository, CourseSourceRow } from './courses.repository';

export interface InMemoryCoursesRepository extends CoursesRepository {
  /** What `review_logs` holds in Postgres; tests add the logs an answer would write. */
  seedLog(userId: string, log: CourseLog): void;
}

/** Reads the in-memory sessions, debriefs and glossary, so deleting a meeting removes its course as in Postgres. */
export function createInMemoryCoursesRepository(deps: {
  sessions: SessionsRepository;
  debrief: InMemoryDebriefRepository;
  glossary: GlossaryRepository;
}): InMemoryCoursesRepository {
  const logs = new Map<string, CourseLog[]>();
  return {
    seedLog(userId, log) {
      logs.set(userId, [...(logs.get(userId) ?? []), log]);
    },

    async listSources(userId, options) {
      const rows: CourseSourceRow[] = [];
      for (const session of await deps.sessions.list(userId)) {
        if (rows.length === options.limit) break;
        if (options.language && session.language !== options.language) continue;
        if (options.sessionIds && !options.sessionIds.includes(session.id)) continue;
        const debrief = await deps.debrief.findLatest(userId, session.id);
        const detail = await deps.sessions.findDetail(userId, session.id);
        if (!debrief || !detail) continue;
        rows.push({
          sessionId: session.id,
          language: session.language,
          startedAt: new Date(session.startedAt),
          debriefAt: new Date(debrief.createdAt),
          headline: debrief.summary.headlineVi,
          source: {
            hardSegments: debrief.hardSegmentIds.flatMap((id) => {
              const segment = detail.segments.find((candidate) => candidate.id === id);
              return segment ? [{ id, text: segment.textEn }] : [];
            }),
            phraseSuggestions: debrief.phraseSuggestions,
            rephrase: debrief.rephrase,
          },
        });
      }
      return rows;
    },

    async listLogs(userId, itemIds, since) {
      return (logs.get(userId) ?? []).filter(
        (log) => itemIds.includes(log.itemId) && log.at.getTime() >= since.getTime(),
      );
    },

    async listTerms(userId, language: LanguageCode, limit) {
      const terms = await deps.glossary.list(userId, language);
      return terms.slice(0, limit).map(({ term, translation }) => ({ term, translation }));
    },
  };
}
