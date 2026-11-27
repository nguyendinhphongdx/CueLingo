import { describe, expect, it, vi } from 'vitest';
import type { ChatStreamPart, StreamChatArgs, StreamChatFn } from './chat';
import { createAiGateway, type AiCallRecord } from './gateway';

const input = {
  language: 'en' as const,
  question: 'SSO là gì?',
  current: ['Speaker 1: SECRET-LINE'],
  glossary: [],
  phrases: [],
  past: [],
  history: [],
};

const collect = async (stream: AsyncIterable<ChatStreamPart>) => {
  const parts: ChatStreamPart[] = [];
  for await (const part of stream) parts.push(part);
  return parts;
};

describe('gateway.ask (meeting.ask)', () => {
  it('streams one step without tools and records the attempt without any content', async () => {
    const calls: StreamChatArgs[] = [];
    const records: AiCallRecord[] = [];
    const streamChat: StreamChatFn = async function* (args) {
      calls.push(args);
      yield { type: 'text_delta', text: 'Đăng nhập một lần [G]' };
      yield { type: 'finish', reason: 'stop', inputTokens: 100, outputTokens: 10 };
    };
    const gateway = createAiGateway({
      googleApiKey: 'k',
      streamChat,
      onCall: (r) => records.push(r),
    });
    const parts = await collect(gateway.ask(input, { userId: 'u', sessionId: 's' }));
    expect(parts[0]).toEqual({ type: 'text_delta', text: 'Đăng nhập một lần [G]' });
    expect(calls[0]!.tools).toEqual([]);
    expect(calls[0]!.maxOutputTokens).toBe(450);
    await vi.waitFor(() => expect(records).toHaveLength(1));
    expect(records[0]).toMatchObject({
      task: 'meeting.ask',
      promptVersion: 'meeting.ask@v1',
      ok: true,
      inputTokens: 100,
      sessionId: 's',
    });
    expect(records[0]!.firstTokenMs).toBeTypeOf('number');
    expect(JSON.stringify(records)).not.toContain('SECRET-LINE');
  });

  it('allows a longer answer with detail and falls back only before the first text', async () => {
    const models: string[] = [];
    const streamChat: StreamChatFn = async function* ({ model, maxOutputTokens }) {
      models.push(`${model}:${maxOutputTokens}`);
      if (models.length === 1) throw new Error('down');
      yield { type: 'text_delta', text: 'ok' };
      yield { type: 'finish', reason: 'stop' };
    };
    const gateway = createAiGateway({ googleApiKey: 'k', streamChat });
    await collect(gateway.ask({ ...input, detail: true }));
    expect(models).toHaveLength(2);
    expect(models[1]).toMatch(/:1200$/);
  });

  it('names its own task when it fails', async () => {
    const streamChat: StreamChatFn = async function* () {
      yield { type: 'text_delta', text: 'nửa' };
      throw new Error('broken');
    };
    const gateway = createAiGateway({ googleApiKey: 'k', streamChat });
    await expect(collect(gateway.ask(input))).rejects.toMatchObject({ task: 'meeting.ask' });
  });
});
