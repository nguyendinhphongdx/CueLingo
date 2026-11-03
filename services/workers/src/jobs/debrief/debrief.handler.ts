import type { AiGateway } from '@cuelingo/ai-gateway';
import { debriefPromptVersionFor } from '@cuelingo/prompts';
import { DebriefContentSchema, SUPPORTED_LANGUAGES, type DebriefContent } from '@cuelingo/shared';
import type { DebriefRepository } from './debrief.repository';

export interface DebriefHandlerDeps {
  debrief: DebriefRepository;
  ai?: Pick<AiGateway, 'json'>;
  log: { warn(message: string, context: { sessionId: string }): void };
}

export async function generateDebrief(
  deps: DebriefHandlerDeps,
  payload: { sessionId: string },
): Promise<{ version?: number; skipped?: 'missing-session' | 'empty-transcript' }> {
  const session = await deps.debrief.findSession(payload.sessionId);
  if (!session) {
    deps.log.warn('debrief.generate skipped: session not found', payload);
    return { skipped: 'missing-session' };
  }
  if (session.segments.length === 0) {
    deps.log.warn('debrief.generate skipped: transcript is empty', payload);
    return { skipped: 'empty-transcript' };
  }
  if (!deps.ai) throw new Error('debrief.generate requires GEMINI_API_KEY');

  const generated = await deps.ai.json(
    'debrief.generate',
    { segments: session.segments, language: session.language },
    DebriefContentSchema,
    { sessionId: session.id },
  );
  const validSegmentIds = new Set(session.segments.map(({ id }) => id));
  // A meeting in a language nobody studies here (Vietnamese, Korean, Chinese) has no learning blocks, whatever the model said.
  const learns = SUPPORTED_LANGUAGES[session.language].learnable;
  const content: DebriefContent = {
    ...generated,
    hardSegmentIds: learns ? generated.hardSegmentIds.filter((id) => validSegmentIds.has(id)) : [],
    phraseSuggestions: learns ? generated.phraseSuggestions : [],
    rephrase: learns ? generated.rephrase : [],
    comprehensionPct: learns && session.segments.length >= 5 ? generated.comprehensionPct : null,
  };
  const version = await deps.debrief.save(
    session.id,
    content,
    debriefPromptVersionFor(session.language),
  );
  return { version };
}
