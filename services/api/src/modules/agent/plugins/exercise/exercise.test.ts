import { runTool, createToolRegistry } from '@cuelingo/agent';
import { AgentCardSchema, type Phrase } from '@cuelingo/shared';
import { describe, expect, it } from 'vitest';
import { scopeCapabilities, corePlugin, type CoreCapabilities } from '../core';
import { exercisePlugin } from './index';
import { fromPhrases, fromText } from './build';

const phrase = (text: string, meaningVi: string | null): Phrase => ({
  id: crypto.randomUUID(),
  phrase: text,
  meaningVi,
  inReview: true,
});
const saved = [
  phrase('circle back', 'quay lại bàn sau'),
  phrase('on track', 'đúng tiến độ'),
  phrase('touch base', 'liên lạc nhanh'),
  phrase('ping me', null),
];
const TEXT = 'The team shipped the release yesterday. Everyone celebrated with coffee. Ok.';

const tool = exercisePlugin.tools[0]!;
const ctx = (listPhrases: () => Promise<Phrase[]>) => ({
  capabilities: { listPhrases },
  signal: new AbortController().signal,
});

describe('exercise plugin: create_exercise', () => {
  it('builds a cloze card from the saved phrases that have a meaning', async () => {
    const result = await runTool(
      tool,
      { kind: 'cloze', source: 'saved_phrases', count: 5 },
      ctx(async () => saved),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card?.kind).toBe('cloze');
    const items = (result.card as { data: { items: Array<{ answer: string }> } }).data.items;
    expect(items.map((i) => i.answer)).toEqual(['circle back', 'on track', 'touch base']);
    expect(result.summary).toBe('Đã tạo bài tập');
  });

  it('builds a quiz card whose answer is the saved phrase and whose distractors are the user’s own', async () => {
    const result = await runTool(
      tool,
      { kind: 'quiz_choice', source: 'saved_phrases' },
      ctx(async () => saved),
    );
    expect(result.ok && result.card?.kind).toBe('quiz_choice');
    if (!result.ok || result.card?.kind !== 'quiz_choice') return;
    const { options, answerIndex } = result.card.data;
    expect(options[answerIndex]).toBe('circle back');
    expect(options).toHaveLength(3);
    expect(options).not.toContain('ping me');
  });

  it('builds cloze and quiz cards from given text, and the same input gives the same card', () => {
    const cloze = fromText('cloze', TEXT, 3);
    expect(cloze).toEqual(fromText('cloze', TEXT, 3));
    expect('card' in cloze && AgentCardSchema.safeParse(cloze.card).success).toBe(true);
    const items = 'card' in cloze && cloze.card.kind === 'cloze' ? cloze.card.data.items : [];
    expect(items.map((i) => i.answer)).toEqual(['yesterday', 'celebrated']);
    expect(items[0]?.sentence).toBe('The team shipped the release ___.');

    const quiz = fromText('quiz_choice', TEXT, 3);
    expect('card' in quiz && AgentCardSchema.safeParse(quiz.card).success).toBe(true);
    if ('card' in quiz && quiz.card.kind === 'quiz_choice') {
      expect(quiz.card.data.options[quiz.card.data.answerIndex]).toBe('yesterday');
    }
  });

  it('says what is missing instead of failing when there is not enough material', async () => {
    expect(fromPhrases('quiz_choice', saved.slice(0, 2), 3)).toHaveProperty('problem');
    expect(fromPhrases('cloze', [phrase('x', null)], 3)).toHaveProperty('problem');
    expect(fromText('cloze', 'Ok. Hi.', 3)).toHaveProperty('problem');
    const result = await runTool(
      tool,
      { kind: 'cloze', source: 'saved_phrases' },
      ctx(async () => []),
    );
    expect(result).toMatchObject({ ok: true, output: { created: false } });
    expect(result.ok && result.card).toBeFalsy();
  });

  it('rejects text mode without text', async () => {
    const result = await runTool(
      tool,
      { kind: 'cloze', source: 'text' },
      ctx(async () => saved),
    );
    expect(result).toMatchObject({ ok: false, reason: 'invalid_input' });
  });

  it('is added next to core without changing the registry (AC16), and reaches only what it declared', async () => {
    const reached: string[] = [];
    const registry = createToolRegistry<CoreCapabilities>({ scope: scopeCapabilities });
    await registry.register(corePlugin);
    const before = registry.tools().map((t) => t.name);
    await registry.register(exercisePlugin);
    expect(registry.tools().map((t) => t.name)).toEqual([...before, 'create_exercise']);
    expect(registry.list().find((p) => p.id === 'exercise')).toMatchObject({
      state: 'loaded',
      permissions: ['phrases:read', 'cards'],
    });

    // Handed a capability it did not declare, the plugin gets a denial instead of the service.
    const full: CoreCapabilities = {
      lookup: async () => {
        reached.push('lookup');
        throw new Error('should not be reached');
      },
      listPhrases: async () => saved,
      savePhrase: async () => {
        reached.push('savePhrase');
        throw new Error('should not be reached');
      },
    };
    const peek = scopeCapabilities(full, exercisePlugin.permissions);
    await expect(peek.savePhrase({ phrase: 'x' })).rejects.toThrow('not granted');
    await expect(peek.lookup({ term: 'x' })).rejects.toThrow('not granted');
    expect(reached).toEqual([]);
    const run = await registry.execute(
      'create_exercise',
      { kind: 'cloze', source: 'saved_phrases' },
      { capabilities: full, signal: new AbortController().signal },
    );
    expect(run.ok).toBe(true);
  });
});
