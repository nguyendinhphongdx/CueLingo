import { describe, expect, it } from 'vitest';
import { recapFixtures } from './fixtures/cases';
import { buildRecapPrompt, RECAP_PROMPT_VERSION, RecapOutputSchema } from './v1';

describe('assist.recap v1', () => {
  it('asks for JSON with a two-sentence summary and at most five bullets', () => {
    const { system, prompt } = buildRecapPrompt(recapFixtures[0]!.input);
    expect(RECAP_PROMPT_VERSION).toBe('assist.recap@v1');
    expect(system).toContain('valid JSON object');
    expect(system).toContain('at most two sentences');
    expect(system).toContain('zero to five');
    expect(prompt).toContain('Mia: We will ship Friday.');
  });

  it('formats lines without inventing a speaker', () => {
    expect(buildRecapPrompt(recapFixtures[1]!.input).prompt).toContain('- Let us revisit');
  });

  it('ships fixtures accepted by the prompt builder', () => {
    for (const fixture of recapFixtures)
      expect(() => buildRecapPrompt(fixture.input)).not.toThrow();
  });

  it('rejects a structured output with more than two summary sentences', () => {
    expect(RecapOutputSchema.safeParse({ summaryVi: 'Một. Hai. Ba.', bulletsVi: [] }).success).toBe(
      false,
    );
  });
});
