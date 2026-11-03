import { describe, expect, it } from 'vitest';
import { debriefFixtures } from './fixtures/cases';
import { debriefViFixtures } from './fixtures/cases-vi';
import { buildDebriefPromptFor, buildDebriefPromptV2, debriefPromptVersionFor } from './v2';

describe('debrief.generate v2 (Vietnamese meetings)', () => {
  const input = debriefViFixtures[0]!.input;

  it('asks for a Vietnamese summary and action items, and empties the learning blocks', () => {
    const { system, prompt } = buildDebriefPromptV2(input);
    expect(system).toContain('cuộc họp tiếng Việt');
    expect(system).toContain('summary');
    expect(system).toContain('actionItems');
    for (const field of ['hardSegmentIds', 'phraseSuggestions', 'rephrase'])
      expect(system).toContain(`- ${field}: luôn là [].`);
    expect(system).toContain('- comprehensionPct: luôn là null.');
    expect(system).not.toContain('người học');
    expect(prompt).toContain('Họ: Chúng ta thống nhất phát hành bản beta');
    expect(prompt).toContain('Tôi: Em sẽ chuẩn bị');
  });

  it('is chosen for languages that are not translated, v1 otherwise', () => {
    expect(debriefPromptVersionFor('vi')).toBe('debrief.generate@v2');
    expect(debriefPromptVersionFor('en')).toBe('debrief.generate@v1');
    expect(debriefPromptVersionFor('ja')).toBe('debrief.generate@v1');
    expect(debriefPromptVersionFor(undefined)).toBe('debrief.generate@v1');
    expect(buildDebriefPromptFor(input).version).toBe('debrief.generate@v2');
    expect(buildDebriefPromptFor(debriefFixtures[0]!.input).version).toBe('debrief.generate@v1');
  });
});
