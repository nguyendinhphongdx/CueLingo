import { describe, expect, it } from 'vitest';
import { RenameSpeakerRequestSchema, SpeakerLabelSchema, SpeakerSchema } from './speaker.dto';
import { SessionDetailSchema, StoredSegmentSchema } from './session.dto';
import { SegmentFinalMessageSchema } from '../ws/ws';

const id = '6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';

describe('SpeakerLabelSchema', () => {
  it.each(['me', 'speaker_1', 'speaker_8'])('accepts %s', (label) => {
    expect(SpeakerLabelSchema.safeParse(label).success).toBe(true);
  });

  it.each(['speaker_0', 'speaker_9', 'speaker_10', 'Speaker_1', 'speaker_1 ', 'them', ''])(
    'rejects %j',
    (label) => {
      expect(SpeakerLabelSchema.safeParse(label).success).toBe(false);
    },
  );
});

describe('RenameSpeakerRequestSchema', () => {
  it('trims the name and accepts null to clear it', () => {
    expect(RenameSpeakerRequestSchema.parse({ displayName: '  Lan  ' }).displayName).toBe('Lan');
    expect(RenameSpeakerRequestSchema.parse({ displayName: null }).displayName).toBeNull();
  });

  it('rejects empty, blank, over-long names and a missing name', () => {
    expect(RenameSpeakerRequestSchema.safeParse({ displayName: '' }).success).toBe(false);
    expect(RenameSpeakerRequestSchema.safeParse({ displayName: '   ' }).success).toBe(false);
    expect(RenameSpeakerRequestSchema.safeParse({ displayName: 'a'.repeat(41) }).success).toBe(
      false,
    );
    expect(RenameSpeakerRequestSchema.safeParse({ displayName: 'a'.repeat(40) }).success).toBe(
      true,
    );
    expect(RenameSpeakerRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('speakers in stored data and WebSocket', () => {
  it('parses a speaker', () => {
    expect(SpeakerSchema.safeParse({ id, label: 'speaker_2', displayName: null }).success).toBe(
      true,
    );
  });

  it('keeps old sessions valid: no speakerId, no speakers', () => {
    const segment = { id, source: 'system', startMs: 0, endMs: 1, textEn: 'hi', textVi: null };
    expect(StoredSegmentSchema.safeParse(segment).success).toBe(true);
    expect(StoredSegmentSchema.safeParse({ ...segment, speakerId: null }).success).toBe(true);
    const detail = SessionDetailSchema.parse({
      id,
      title: null,
      startedAt: '2026-11-04T10:00:00.000Z',
      endedAt: null,
      status: 'live',
      assistLevel: 3,
      language: 'en',
      segments: [],
    });
    expect(detail.speakers).toEqual([]);
  });

  it('accepts a label on segment.final and rejects one outside 1-8', () => {
    const message = {
      type: 'segment.final',
      segmentId: id,
      stream: 'system',
      startMs: 0,
      endMs: 1,
      text: 'hi',
      words: [],
    };
    expect(SegmentFinalMessageSchema.safeParse(message).success).toBe(true);
    expect(SegmentFinalMessageSchema.safeParse({ ...message, speaker: 'speaker_3' }).success).toBe(
      true,
    );
    expect(SegmentFinalMessageSchema.safeParse({ ...message, speaker: 'speaker_9' }).success).toBe(
      false,
    );
  });
});

describe('reserved speaker names', () => {
  it('rejects names that look like the system labels', () => {
    for (const name of [
      'Tôi',
      'tôi',
      'Me',
      'Người khác',
      'NGƯỜI KHÁC',
      'Speaker 3',
      'speaker',
      ' speaker 12 ',
    ]) {
      expect(RenameSpeakerRequestSchema.safeParse({ displayName: name }).success).toBe(false);
    }
  });

  it('accepts real names, including ones that merely contain those words', () => {
    for (const name of ['Lan', 'Anh Tôi', 'Speaker Nam', 'Minh Người']) {
      expect(RenameSpeakerRequestSchema.safeParse({ displayName: name }).success).toBe(true);
    }
  });
});
