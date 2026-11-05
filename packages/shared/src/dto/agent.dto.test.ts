import { describe, expect, it } from 'vitest';
import { ErrorCode } from '../errors/error-code';
import {
  AgentCardSchema,
  AgentQuotaSchema,
  AgentStreamEventSchema,
  ConversationSchema,
  MessagePartSchema,
  MessageSchema,
  SendMessageRequestSchema,
} from './agent.dto';
import { SavePhraseRequestSchema, normalizePhrase } from './phrase.dto';

const id = '3f2b8a52-5a0c-4d4e-9a53-0f4a1f8d2b11';
const now = '2026-11-09T09:00:00.000Z';

describe('SendMessageRequestSchema', () => {
  it('accepts content and trims it', () => {
    expect(SendMessageRequestSchema.parse({ content: '  hello  ' }).content).toBe('hello');
  });

  it('accepts an optional learnable language', () => {
    expect(SendMessageRequestSchema.safeParse({ content: 'hi', language: 'ja' }).success).toBe(
      true,
    );
    expect(SendMessageRequestSchema.safeParse({ content: 'hi', language: 'vi' }).success).toBe(
      false,
    );
  });

  it('rejects empty, over-long and extra fields', () => {
    expect(SendMessageRequestSchema.safeParse({ content: '   ' }).success).toBe(false);
    expect(SendMessageRequestSchema.safeParse({ content: 'a'.repeat(4001) }).success).toBe(false);
    expect(SendMessageRequestSchema.safeParse({ content: 'a'.repeat(4000) }).success).toBe(true);
    expect(SendMessageRequestSchema.safeParse({ content: 'hi', userId: 'x' }).success).toBe(false);
  });
});

describe('AgentCardSchema', () => {
  it('accepts every card kind', () => {
    const cards = [
      { kind: 'flashcards', data: { cards: [{ front: 'follow up', back: 'theo dõi' }] } },
      {
        kind: 'cloze',
        data: { items: [{ sentence: 'Let me ___ on that.', answer: 'follow up' }] },
      },
      {
        kind: 'quiz_choice',
        data: { question: 'Which is polite?', options: ['a', 'b'], answerIndex: 1 },
      },
      { kind: 'compare_table', data: { columns: ['a', 'b'], rows: [['1', '2']] } },
      { kind: 'phrase_list', data: { items: [{ phrase: 'circle back' }] } },
    ];
    for (const card of cards) expect(AgentCardSchema.safeParse(card).success).toBe(true);
  });

  it('rejects an unknown kind', () => {
    expect(AgentCardSchema.safeParse({ kind: 'html', data: {} }).success).toBe(false);
  });

  it('rejects a cloze sentence without a blank', () => {
    const card = { kind: 'cloze', data: { items: [{ sentence: 'No blank', answer: 'x' }] } };
    expect(AgentCardSchema.safeParse(card).success).toBe(false);
  });

  it('rejects a quiz answer outside the options', () => {
    const card = {
      kind: 'quiz_choice',
      data: { question: 'q', options: ['a', 'b'], answerIndex: 2 },
    };
    expect(AgentCardSchema.safeParse(card).success).toBe(false);
  });

  it('rejects a table whose rows do not match the columns', () => {
    const card = { kind: 'compare_table', data: { columns: ['a', 'b'], rows: [['1']] } };
    expect(AgentCardSchema.safeParse(card).success).toBe(false);
  });

  it('rejects extra fields inside data', () => {
    const card = { kind: 'phrase_list', data: { items: [{ phrase: 'x', html: '<b>' }] } };
    expect(AgentCardSchema.safeParse(card).success).toBe(false);
  });
});

describe('MessageSchema', () => {
  const message = {
    id,
    conversationId: id,
    seq: 1,
    role: 'assistant',
    parts: [
      { type: 'text', text: 'Hi' },
      { type: 'tool_step', callId: 'c1', tool: 'lookup_word', status: 'ok' },
      { type: 'card', card: { kind: 'phrase_list', data: { items: [{ phrase: 'x' }] } } },
    ],
    status: 'complete',
    createdAt: now,
  };

  it('accepts text, tool_step and card parts', () => {
    expect(MessageSchema.safeParse(message).success).toBe(true);
  });

  it('rejects an unknown part or status', () => {
    expect(MessagePartSchema.safeParse({ type: 'html_block', html: '<b/>' }).success).toBe(false);
    expect(MessageSchema.safeParse({ ...message, status: 'done' }).success).toBe(false);
  });
});

describe('ConversationSchema', () => {
  it('rejects a title over 120 characters', () => {
    const base = { id, language: 'en', createdAt: now, updatedAt: now };
    expect(ConversationSchema.safeParse({ ...base, title: 'a'.repeat(120) }).success).toBe(true);
    expect(ConversationSchema.safeParse({ ...base, title: 'a'.repeat(121) }).success).toBe(false);
  });
});

describe('AgentStreamEventSchema', () => {
  it('accepts each event type', () => {
    const events = [
      { type: 'status', status: 'thinking' },
      { type: 'text_delta', text: 'Hel' },
      { type: 'tool_call', callId: 'c1', tool: 'lookup_word' },
      { type: 'tool_result', callId: 'c1', tool: 'lookup_word', ok: false, summary: 'Lỗi' },
      { type: 'card', card: { kind: 'phrase_list', data: { items: [{ phrase: 'x' }] } } },
      { type: 'done', status: 'stopped' },
      { type: 'error', code: 'AGENT_FAILED' },
    ];
    for (const e of events) expect(AgentStreamEventSchema.safeParse(e).success).toBe(true);
  });

  it('rejects a bad done status and an unknown error code', () => {
    expect(AgentStreamEventSchema.safeParse({ type: 'done', status: 'ok' }).success).toBe(false);
    expect(AgentStreamEventSchema.safeParse({ type: 'error', code: 'NOPE' }).success).toBe(false);
  });
});

describe('AgentQuotaSchema', () => {
  it('accepts used and limit for turns, tokens and cost', () => {
    const quota = {
      turns: { used: 1, limit: 60 },
      tokens: { used: 100, limit: 400_000 },
      costUsd: { used: 0.01, limit: 0.25 },
      resetsAt: now,
    };
    expect(AgentQuotaSchema.safeParse(quota).success).toBe(true);
  });
});

describe('error codes', () => {
  it('has the agent codes', () => {
    expect(ErrorCode.AgentQuotaExceeded).toBe('AGENT_QUOTA_EXCEEDED');
    expect(ErrorCode.AgentDisabled).toBe('AGENT_DISABLED');
    expect(ErrorCode.AgentFailed).toBe('AGENT_FAILED');
  });
});

describe('SavePhraseRequestSchema.context', () => {
  it('accepts a context up to 500 characters', () => {
    expect(
      SavePhraseRequestSchema.safeParse({ phrase: 'x', context: 'a'.repeat(500) }).success,
    ).toBe(true);
    expect(
      SavePhraseRequestSchema.safeParse({ phrase: 'x', context: 'a'.repeat(501) }).success,
    ).toBe(false);
  });
});

describe('normalizePhrase', () => {
  it('collapses whitespace and lowercases', () => {
    expect(normalizePhrase('Follow   UP\n')).toBe('follow up ');
    expect(normalizePhrase('Circle Back')).toBe('circle back');
  });
});
