import { describe, expect, it } from 'vitest';
import { lookupFixtures } from './fixtures/cases';
import { buildLookupPrompt, LOOKUP_PROMPT_VERSION, LookupOutputSchema } from './v1';

describe('assist.lookup v1', () => {
  it('asks for JSON with Vietnamese meaning and a short example', () => {
    const { system, prompt } = buildLookupPrompt(lookupFixtures[0]!.input);
    expect(LOOKUP_PROMPT_VERSION).toBe('assist.lookup@v1');
    expect(system).toContain('valid JSON object');
    expect(system).toContain('meaningVi');
    expect(system).toContain('exampleEn');
    expect(prompt).toContain('Meeting context');
  });

  it('omits context when none is supplied', () => {
    expect(buildLookupPrompt({ term: 'roadmap' }).prompt).toBe('Term:\nroadmap');
  });

  it('ships fixtures accepted by the prompt builder', () => {
    for (const fixture of lookupFixtures)
      expect(() => buildLookupPrompt(fixture.input)).not.toThrow();
  });

  it('requires a short example in the structured output', () => {
    expect(LookupOutputSchema.safeParse({ term: 'table', meaningVi: 'hoãn' }).success).toBe(false);
  });
});

describe('assist.lookup language', () => {
  it('asks for a reading only for languages that have one', () => {
    const japanese = buildLookupPrompt({ term: '検討', language: 'ja' }).system;
    expect(japanese).toContain('Japanese');
    expect(japanese).toContain('reading');
    expect(buildLookupPrompt({ term: 'review' }).system).not.toContain('reading');
  });
});
