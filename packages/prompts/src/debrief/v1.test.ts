import { describe, expect, it } from 'vitest';
import { debriefFixtures } from './fixtures/cases';
import { buildDebriefPrompt, DEBRIEF_PROMPT_VERSION, DEBRIEF_TRANSCRIPT_MAX_CHARS } from './v1';

describe('debrief.generate v1', () => {
  it('describes all five blocks and constrains ids and rephrases', () => {
    const { system, prompt } = buildDebriefPrompt(debriefFixtures[0]!.input);

    expect(DEBRIEF_PROMPT_VERSION).toBe('debrief.generate@v1');
    for (const field of [
      'summary',
      'actionItems',
      'hardSegmentIds',
      'phraseSuggestions',
      'rephrase',
      'comprehensionPct',
    ]) {
      expect(system).toContain(field);
    }
    expect(system).toContain('chỉ chọn id xuất hiện trong transcript');
    expect(system).toContain('chỉ dùng câu có nhãn "Tôi"');
    expect(prompt).toContain('Họ: We will ship');
    expect(prompt).toContain('Tôi: I will prepare');
  });

  it('keeps the most recent transcript within about 12,000 characters', () => {
    const input = {
      segments: Array.from({ length: 20 }, (_, index) => ({
        id: `${String(index).padStart(8, '0')}-0000-4000-8000-000000000000`,
        source: 'system' as const,
        textEn: `${index}:${'x'.repeat(900)}`,
      })),
    };

    const { prompt } = buildDebriefPrompt(input);

    expect(prompt.length).toBeLessThanOrEqual(DEBRIEF_TRANSCRIPT_MAX_CHARS + 30);
    expect(prompt).not.toContain('Họ: 0:');
    expect(prompt).toContain('Họ: 19:');
  });

  it('ships three short VI/EN fixtures accepted by the builder', () => {
    expect(debriefFixtures).toHaveLength(3);
    for (const fixture of debriefFixtures)
      expect(() => buildDebriefPrompt(fixture.input)).not.toThrow();
  });
});
