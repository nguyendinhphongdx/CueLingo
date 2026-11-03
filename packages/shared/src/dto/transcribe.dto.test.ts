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
