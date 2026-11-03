import { describe, expect, it } from 'vitest';
import { debriefViFixtures } from './fixtures/cases-vi';
import { buildDebriefPromptV2 } from './v2';

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
});
