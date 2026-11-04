import type { AiGateway } from '@cuelingo/ai-gateway';
import type { DebriefContent } from '@cuelingo/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  buildDebriefPromptFor,
  debriefViFixtures,
  type DebriefPromptInput,
} from '@cuelingo/prompts';
import { generateDebrief, type DebriefRepository, type DebriefSession } from './index';

const SESSION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SEGMENT_IDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
];
const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999';

const generated: DebriefContent = {
  summary: { headlineVi: 'Kế hoạch phát hành', bulletsVi: ['Phát hành vào thứ Sáu'] },
  actionItems: [{ textVi: 'Chuẩn bị ghi chú phát hành', kind: 'todo', owner: 'Tôi' }],
  hardSegmentIds: [SEGMENT_IDS[0]!, UNKNOWN_ID],
  phraseSuggestions: [{ phrase: 'ship the beta', meaningVi: 'phát hành bản beta' }],
  rephrase: [{ said: 'I prepare it', better: 'I will prepare it' }],
  comprehensionPct: 80,
};

function setup(session: DebriefSession | null, output: DebriefContent = generated) {
  const saved: Array<{ content: DebriefContent; promptVersion: string; version: number }> = [];
  const debrief: DebriefRepository = {
    findSession: vi.fn(async () => session),
    async save(_sessionId, content, promptVersion) {
      const version = saved.length + 1;
      saved.push({ content, promptVersion, version });
      return version;
    },
  };
  const json = vi.fn(async () => output);
  const ai = { json } as unknown as Pick<AiGateway, 'json'>;
  const warn = vi.fn();
  return { saved, json, warn, deps: { debrief, ai, log: { warn } } };
}

const transcript = (count = SEGMENT_IDS.length): DebriefSession => ({
  id: SESSION_ID,
  language: 'en',
  segments: SEGMENT_IDS.slice(0, count).map((id, index) => ({
    id,
    source: index % 2 === 0 ? 'system' : 'mic',
    textEn: `Sentence ${index + 1}`,
  })),
});

describe('debrief.generate', () => {
  it('writes a valid debrief, advances versions, and marks content ready for persistence (AC1)', async () => {
    const state = setup(transcript());

    await expect(generateDebrief(state.deps, { sessionId: SESSION_ID })).resolves.toEqual({
      version: 1,
    });
    await expect(generateDebrief(state.deps, { sessionId: SESSION_ID })).resolves.toEqual({
      version: 2,
    });

    expect(state.saved).toHaveLength(2);
    expect(state.saved[0]?.promptVersion).toBe('debrief.generate@v4');
    expect(state.saved[0]?.content.summary.headlineVi).toBe('Kế hoạch phát hành');
  });

  it('propagates invalid AI output failure without saving partial data (AC2)', async () => {
    const state = setup(transcript());
    state.json.mockRejectedValueOnce(new Error('AI task debrief.generate failed: invalid JSON'));

    await expect(generateDebrief(state.deps, { sessionId: SESSION_ID })).rejects.toThrow(
      'invalid JSON',
    );
    expect(state.saved).toEqual([]);
  });

  it('skips missing sessions and empty transcripts without calling AI (AC3)', async () => {
    for (const session of [null, transcript(0)]) {
      const state = setup(session);
      await expect(generateDebrief(state.deps, { sessionId: SESSION_ID })).resolves.toHaveProperty(
        'skipped',
      );
      expect(state.json).not.toHaveBeenCalled();
      expect(state.saved).toEqual([]);
      expect(state.warn).toHaveBeenCalledWith(expect.any(String), { sessionId: SESSION_ID });
    }
  });

  it('removes unknown hard segment ids (AC4)', async () => {
    const state = setup(transcript());
    await generateDebrief(state.deps, { sessionId: SESSION_ID });
    expect(state.saved[0]?.content.hardSegmentIds).toEqual([SEGMENT_IDS[0]]);
  });

  it('sets comprehension to null with fewer than five sentences', async () => {
    const state = setup(transcript(4));
    await generateDebrief(state.deps, { sessionId: SESSION_ID });
    expect(state.saved[0]?.content.comprehensionPct).toBeNull();
  });

  it('fails clearly when the API key is unavailable, without crashing worker startup', async () => {
    const state = setup(transcript());
    await expect(
      generateDebrief({ ...state.deps, ai: undefined }, { sessionId: SESSION_ID }),
    ).rejects.toThrow('GEMINI_API_KEY');
    expect(state.saved).toEqual([]);
  });

  it.each(['vi', 'ko', 'zh'] as const)(
    'writes a %s meeting debrief with v5 and empty learning blocks',
    async (language) => {
      const fixture = debriefViFixtures[0]!.input;
      const session: DebriefSession = {
        id: SESSION_ID,
        language,
        segments: fixture.segments,
      };
      // The model ignores the instructions: the handler still empties the learning blocks.
      const state = setup(session, {
        ...generated,
        hardSegmentIds: [fixture.segments[0]!.id],
        comprehensionPct: 90,
      });

      await expect(generateDebrief(state.deps, { sessionId: SESSION_ID })).resolves.toEqual({
        version: 1,
      });

      expect(state.json).toHaveBeenCalledWith(
        'debrief.generate',
        { segments: fixture.segments, language },
        expect.anything(),
        { sessionId: SESSION_ID },
      );
      const saved = state.saved[0]!;
      expect(saved.promptVersion).toBe('debrief.generate@v5');
      expect(saved.content.summary.headlineVi).toBe('Kế hoạch phát hành');
      expect(saved.content.actionItems).toHaveLength(1);
      expect(saved.content.hardSegmentIds).toEqual([]);
      expect(saved.content.phraseSuggestions).toEqual([]);
      expect(saved.content.rephrase).toEqual([]);
      expect(saved.content.comprehensionPct).toBeNull();
    },
  );

  it('keeps the learning blocks and v4 for a Japanese meeting', async () => {
    const session: DebriefSession = { ...transcript(), language: 'ja' };
    const state = setup(session);

    await generateDebrief(state.deps, { sessionId: SESSION_ID });

    const saved = state.saved[0]!;
    expect(saved.promptVersion).toBe('debrief.generate@v4');
    expect(saved.content.hardSegmentIds).toEqual([SEGMENT_IDS[0]]);
    expect(saved.content.phraseSuggestions).toHaveLength(1);
    expect(saved.content.comprehensionPct).toBe(80);
  });

  it('passes speaker labels and names through to the prompt input', async () => {
    const session: DebriefSession = {
      ...transcript(),
      segments: transcript().segments.map((segment, index) => ({
        ...segment,
        speakerLabel: index === 0 ? 'speaker_1' : null,
        speakerName: index === 0 ? 'Lan' : null,
      })),
    };
    const state = setup(session);

    await generateDebrief(state.deps, { sessionId: SESSION_ID });

    expect(state.json).toHaveBeenCalledWith(
      'debrief.generate',
      { segments: session.segments, language: 'en' },
      expect.anything(),
      { sessionId: SESSION_ID },
    );
    const input = (state.json.mock.calls as unknown[][])[0]![1] as DebriefPromptInput;
    const prompt = buildDebriefPromptFor(input).prompt;
    expect(prompt).toContain(`[${SEGMENT_IDS[0]}] Lan: Sentence 1`);
    // A sentence from before speaker labels follows its source.
    expect(prompt).toContain(`[${SEGMENT_IDS[1]}] Tôi: Sentence 2`);
    expect(prompt).toContain(`[${SEGMENT_IDS[2]}] Người khác: Sentence 3`);
  });

  it('keeps the checks on a session without speakers: unknown ids removed, version saved', async () => {
    const state = setup(transcript());
    await generateDebrief(state.deps, { sessionId: SESSION_ID });
    expect(state.saved[0]?.content.hardSegmentIds).toEqual([SEGMENT_IDS[0]]);
    expect(state.saved[0]?.promptVersion).toBe('debrief.generate@v4');
  });
});
