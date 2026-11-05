import { describe, expect, it } from 'vitest';
import { buildContext, estimateMessageTokens, estimateTokens } from './context';
import type { ModelMessage } from './model';

const user = (content: string): ModelMessage => ({ role: 'user', content });
const assistant = (content: string): ModelMessage => ({ role: 'assistant', content });
const withCall = (id: string): ModelMessage => ({
  role: 'assistant',
  content: '',
  toolCalls: [{ id, name: 'lookup_word', input: { term: 'x' } }],
});
const result = (id: string): ModelMessage => ({
  role: 'tool',
  toolCallId: id,
  name: 'lookup_word',
  content: '{"ok":true}',
});

const long = 'x'.repeat(400); // about 100 tokens

describe('buildContext', () => {
  it('returns everything when it fits', () => {
    const history = [user('hi'), assistant('hello'), user('again')];
    const out = buildContext({ history, budgetTokens: 1_000 });
    expect(out.messages).toEqual(history);
    expect(out.droppedTurns).toBe(0);
  });

  it('is deterministic', () => {
    const history = [user(long), assistant(long), user(long), assistant(long), user('now')];
    const a = buildContext({ history, budgetTokens: 250 });
    const b = buildContext({ history: structuredClone(history), budgetTokens: 250 });
    expect(a).toEqual(b);
  });

  it('drops the oldest turns first and keeps the last turn', () => {
    const history = [
      user('first'),
      assistant(long),
      user('second'),
      assistant(long),
      user('third'),
    ];
    const out = buildContext({ history, budgetTokens: 100 });
    expect(out.droppedTurns).toBe(2);
    expect(out.messages).toEqual([user('third')]);
  });

  it('keeps the last turn even when it alone is over budget', () => {
    const out = buildContext({
      history: [user('old'), user(long), assistant(long)],
      budgetTokens: 10,
    });
    expect(out.messages).toEqual([user(long), assistant(long)]);
  });

  it('never splits a tool call from its result', () => {
    const history = [
      user('old'),
      assistant(long),
      user('look it up'),
      withCall('c1'),
      result('c1'),
      assistant('done'),
    ];
    const out = buildContext({ history, budgetTokens: 60 });
    const ids = out.messages.flatMap((m) =>
      m.role === 'assistant' ? (m.toolCalls ?? []).map((c) => c.id) : [],
    );
    const answered = out.messages.flatMap((m) => (m.role === 'tool' ? [m.toolCallId] : []));
    expect(ids).toEqual(answered);
    expect(ids).toEqual(['c1']);
  });

  it('removes a call without a result and a result without a call', () => {
    const out = buildContext({
      history: [user('q'), withCall('lost'), result('orphan'), assistant('answer')],
      budgetTokens: 1_000,
    });
    expect(out.messages).toEqual([user('q'), assistant('answer')]);
  });

  it('counts the reserved system prompt against the budget', () => {
    const history = [user('a'.repeat(200)), assistant('b'), user('c')];
    expect(buildContext({ history, budgetTokens: 100 }).droppedTurns).toBe(0);
    expect(buildContext({ history, budgetTokens: 100, reservedTokens: 95 }).droppedTurns).toBe(1);
  });

  it('handles an empty history', () => {
    expect(buildContext({ history: [], budgetTokens: 10 }).messages).toEqual([]);
  });
});

describe('estimateTokens', () => {
  it('is about one token per four characters and counts tool calls', () => {
    expect(estimateTokens('abcdefgh')).toBe(2);
    expect(estimateMessageTokens(withCall('c1'))).toBeGreaterThan(
      estimateMessageTokens(assistant('')),
    );
  });
});
