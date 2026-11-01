import { describe, expect, it } from 'vitest';
import { composeFixtures } from './fixtures/cases';
import { buildComposePrompt, COMPOSE_PROMPT_VERSION, ComposeOutputSchema } from './v1';

describe('assist.compose v1', () => {
  it('asks for JSON with exactly two concise English options', () => {
    const { system, prompt } = buildComposePrompt(composeFixtures[0]!.input);
    expect(COMPOSE_PROMPT_VERSION).toBe('assist.compose@v1');
    expect(system).toContain('valid JSON object');
    expect(system).toContain('exactly two choices');
    expect(system).toContain('polite, concise English');
    expect(prompt).toContain('Vietnamese intent');
  });

  it('puts optional context before the intent', () => {
    const { prompt } = buildComposePrompt(composeFixtures[1]!.input);
    expect(prompt.indexOf('Recent meeting context')).toBeLessThan(
      prompt.indexOf('Vietnamese intent'),
    );
  });

  it('ships fixtures accepted by the prompt builder', () => {
    for (const fixture of composeFixtures)
      expect(() => buildComposePrompt(fixture.input)).not.toThrow();
  });

  it('requires exactly two options in the structured output', () => {
    expect(ComposeOutputSchema.safeParse({ options: [{ en: 'Could you clarify?' }] }).success).toBe(
      false,
    );
  });
});
