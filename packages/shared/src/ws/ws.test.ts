import { describe, expect, it } from 'vitest';
import { ClientMessageSchema, ServerMessageSchema } from './ws';

const sessionId = '9ee72a14-8cd4-4f2e-8131-4ed638e2d875';
const segmentId = 'c67ef96d-7890-49a7-9a55-66c49272e38f';

describe('ClientMessageSchema', () => {
  it.each([
    {
      type: 'hello',
      sessionId,
      token: 'access-token',
      sttSource: 'local',
      assistLevel: 3,
    },
    {
      type: 'segment.final',
      segmentId,
      stream: 'system',
      startMs: 100,
      endMs: 900,
      text: 'Could you walk me through that?',
      words: [{ text: 'Could', startMs: 100, endMs: 240 }],
    },
    { type: 'event' },
  ])('accepts $type', (message) => {
    expect(ClientMessageSchema.safeParse(message).success).toBe(true);
  });

  it.each([
    ['unknown message type', { type: 'audio' }],
    [
      'invalid hello fields',
      { type: 'hello', sessionId: 'not-a-uuid', token: '', sttSource: 'cloud', assistLevel: 6 },
    ],
    [
      'end before start',
      {
        type: 'segment.final',
        segmentId,
        stream: 'system',
        startMs: 901,
        endMs: 900,
        text: 'Hello',
        words: [],
      },
    ],
    [
      'invalid segment fields',
      {
        type: 'segment.final',
        segmentId: 'not-a-uuid',
        stream: 'speaker',
        startMs: 0,
        endMs: 1,
        text: '',
        words: [{ text: 'word', startMs: 0 }],
      },
    ],
    [
      'text over 2000 characters',
      {
        type: 'segment.final',
        segmentId,
        stream: 'mic',
        startMs: 0,
        endMs: 1,
        text: 'a'.repeat(2_001),
        words: [],
      },
    ],
    ['unexpected fields', { type: 'event', payload: {} }],
  ])('rejects %s', (_case, message) => {
    expect(ClientMessageSchema.safeParse(message).success).toBe(false);
  });
});

describe('ServerMessageSchema', () => {
  it.each([
    { type: 'ready', sessionId },
    {
      type: 'translation',
      segmentId,
      textVi: 'Bạn có thể giải thích không?',
      hardWords: ['walk through'],
    },
    { type: 'error', code: 'ws_translation_failed', retryable: true },
  ])('accepts $type', (message) => {
    expect(ServerMessageSchema.safeParse(message).success).toBe(true);
  });

  it.each([
    ['ready without a valid session', { type: 'ready', sessionId: 'bad' }],
    ['translation without hardWords', { type: 'translation', segmentId, textVi: 'Xin chào' }],
    ['unknown error code', { type: 'error', code: 'ws_unknown', retryable: false }],
    ['invalid retryable flag', { type: 'error', code: 'ws_bad_message', retryable: 'yes' }],
  ])('rejects %s', (_case, message) => {
    expect(ServerMessageSchema.safeParse(message).success).toBe(false);
  });
});
