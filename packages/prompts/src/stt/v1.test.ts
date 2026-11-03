import { describe, expect, it } from 'vitest';
import { sttFixtures } from './fixtures/cases';
import { buildSttPrompt, STT_PROMPT_VERSION, SttInputSchema } from './v1';

describe('stt.transcribe v1', () => {
  it('asks for a verbatim, plain-text transcript in the spoken language', () => {
    const { system, prompt } = buildSttPrompt({ language: 'vi' });
    expect(STT_PROMPT_VERSION).toBe('stt.transcribe@v1');
    expect(system).toContain('spoken in Vietnamese');
    expect(system).toContain('Do not translate');
    expect(system).toContain('ONLY the spoken words');
    expect(system).toContain('no timestamps');
    expect(system).toContain('empty string');
    expect(prompt).toBe('Transcribe the audio.');
  });

  it('names the language it is given', () => {
    expect(buildSttPrompt({ language: 'ja' }).system).toContain('spoken in Japanese');
  });

  it('rejects an unknown language', () => {
    expect(SttInputSchema.safeParse({ language: 'xx' }).success).toBe(false);
    expect(() => buildSttPrompt({ language: 'xx' as never })).toThrow();
  });

  it('ships fixtures that all parse', () => {
    for (const f of sttFixtures) expect(SttInputSchema.safeParse(f.input).success).toBe(true);
  });
});
