import type { Debrief, DebriefFeedbackRequest } from '@cuelingo/shared';
import type { DebriefRepository } from './debrief.repository';

export interface InMemoryDebriefRepository extends DebriefRepository {
  seed(userId: string, debrief: Debrief): void;
  readonly feedback: Array<{ userId: string; debriefId: string; input: DebriefFeedbackRequest }>;
}

export function createInMemoryDebriefRepository(): InMemoryDebriefRepository {
  const rows: Array<Debrief & { userId: string }> = [];
  const feedback: InMemoryDebriefRepository['feedback'] = [];

  return {
    feedback,
    seed(userId, debrief) {
      rows.push({ ...debrief, userId });
    },
    async findLatest(userId, sessionId) {
      const row = rows
        .filter((item) => item.userId === userId && item.sessionId === sessionId)
        .sort((a, b) => b.version - a.version)[0];
      if (!row) return null;
      const { userId: _userId, ...debrief } = row;
      return debrief;
    },
    async saveFeedback(userId, debriefId, input) {
      if (!rows.some((item) => item.userId === userId && item.id === debriefId)) return false;
      feedback.push({ userId, debriefId, input });
      return true;
    },
  };
}
