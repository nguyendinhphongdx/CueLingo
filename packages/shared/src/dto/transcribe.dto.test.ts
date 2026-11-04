import { describe, expect, it } from 'vitest';
import {
  TRANSCRIBE_MAX_PCM_CHARS,
  TranscribeRequestSchema,
  TranscribeResponseSchema,
} from './transcribe.dto';

const valid = {
  segmentId: '6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f',
  stream: 'system',
  startMs: 1000,
  endMs: 4000,
  sampleRate: 16000,
  pcm: 'AAAA',
};

describe('TranscribeRequestSchema', () => {
  it('accepts an utterance', () => {
    expect(TranscribeRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects pcm over the size cap', () => {
    const pcm = 'A'.repeat(TRANSCRIBE_MAX_PCM_CHARS + 4);
    expect(TranscribeRequestSchema.safeParse({ ...valid, pcm }).success).toBe(false);
    const atCap = 'A'.repeat(TRANSCRIBE_MAX_PCM_CHARS);
    expect(TranscribeRequestSchema.safeParse({ ...valid, pcm: atCap }).success).toBe(true);
  });

  it('accepts up to 3 previous sentences of at most 400 characters', () => {
    expect(TranscribeRequestSchema.safeParse({ ...valid, previous: [] }).success).toBe(true);
    const ok = { ...valid, previous: ['a', 'b'.repeat(400), 'c'] };
    expect(TranscribeRequestSchema.safeParse(ok).success).toBe(true);
  });

  it('rejects more than 3 previous sentences or one over 400 characters', () => {
    const four = { ...valid, previous: ['a', 'b', 'c', 'd'] };
    expect(TranscribeRequestSchema.safeParse(four).success).toBe(false);
    const long = { ...valid, previous: ['x'.repeat(401)] };
    expect(TranscribeRequestSchema.safeParse(long).success).toBe(false);
  });

  it('rejects a sample rate other than 16000', () => {
    expect(TranscribeRequestSchema.safeParse({ ...valid, sampleRate: 48000 }).success).toBe(false);
  });

  it('rejects endMs before startMs', () => {
    expect(
      TranscribeRequestSchema.safeParse({ ...valid, startMs: 5000, endMs: 4000 }).success,
    ).toBe(false);
  });

  it('rejects negative times, unknown streams and non-base64 audio', () => {
    expect(TranscribeRequestSchema.safeParse({ ...valid, startMs: -1 }).success).toBe(false);
    expect(TranscribeRequestSchema.safeParse({ ...valid, stream: 'other' }).success).toBe(false);
    expect(TranscribeRequestSchema.safeParse({ ...valid, pcm: 'not base64!' }).success).toBe(false);
  });
});

describe('TranscribeResponseSchema', () => {
  it('allows empty text', () => {
    expect(TranscribeResponseSchema.parse({ segmentId: valid.segmentId, text: '' }).text).toBe('');
  });
});

describe('speaker labelling fields', () => {
  const known = { label: 'speaker_1', hint: 'low, calm voice', lastText: 'Shall we start?' };

  it('accepts knownSpeakers and still accepts a request without them', () => {
    expect(TranscribeRequestSchema.safeParse(valid).success).toBe(true);
    expect(TranscribeRequestSchema.safeParse({ ...valid, knownSpeakers: [known] }).success).toBe(
      true,
    );
  });

  it('rejects "me", labels outside 1-8, long hints, long lastText and more than 8', () => {
    const parse = (knownSpeakers: unknown) =>
      TranscribeRequestSchema.safeParse({ ...valid, knownSpeakers }).success;
    expect(parse([{ ...known, label: 'me' }])).toBe(false);
    expect(parse([{ ...known, label: 'speaker_9' }])).toBe(false);
    expect(parse([{ ...known, hint: 'a'.repeat(61) }])).toBe(false);
    expect(parse([{ ...known, lastText: 'a'.repeat(201) }])).toBe(false);
    expect(parse(Array.from({ length: 8 }, () => known))).toBe(true);
    expect(parse(Array.from({ length: 9 }, () => known))).toBe(false);
  });

  it('accepts a response without speaker and with each kind of speaker', () => {
    const base = { segmentId: valid.segmentId, text: 'hi' };
    expect(TranscribeResponseSchema.safeParse(base).success).toBe(true);
    for (const label of ['speaker_2', 'new', 'unknown']) {
      expect(TranscribeResponseSchema.safeParse({ ...base, speaker: { label } }).success).toBe(
        true,
      );
    }
  });

  it('rejects a response speaker with a bad label, a long hint or extra keys', () => {
    const base = { segmentId: valid.segmentId, text: 'hi' };
    const parse = (speaker: unknown) =>
      TranscribeResponseSchema.safeParse({ ...base, speaker }).success;
    expect(parse({ label: 'me' })).toBe(false);
    expect(parse({ label: 'speaker_9' })).toBe(false);
    expect(parse({ label: 'new', hint: 'a'.repeat(61) })).toBe(false);
    expect(parse({ label: 'new', extra: 1 })).toBe(false);
  });
});
