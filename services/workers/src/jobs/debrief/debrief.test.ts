import type { AiGateway } from '@cuelingo/ai-gateway';
import type { DebriefContent } from '@cuelingo/shared';
import { describe, expect, it, vi } from 'vitest';
import { debriefViFixtures } from '@cuelingo/prompts';
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
    expect(state.saved[0]?.promptVersion).toBe('debrief.generate@v1');
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

  it('writes a Vietnamese meeting debrief with v2 and empty learning blocks', async () => {
    const fixture = debriefViFixtures[0]!.input;
    const session: DebriefSession = {
      id: SESSION_ID,
      language: 'vi',
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
      { segments: fixture.segments, language: 'vi' },
      expect.anything(),
      { sessionId: SESSION_ID },
    );
    const saved = state.saved[0]!;
    expect(saved.promptVersion).toBe('debrief.generate@v2');
    expect(saved.content.summary.headlineVi).toBe('Kế hoạch phát hành');
    expect(saved.content.actionItems).toHaveLength(1);
    expect(saved.content.hardSegmentIds).toEqual([]);
    expect(saved.content.phraseSuggestions).toEqual([]);
    expect(saved.content.rephrase).toEqual([]);
    expect(saved.content.comprehensionPct).toBeNull();
  });
});
