import { describe, expect, it } from 'vitest';
import { FollowupRequestSchema, FollowupResponseSchema } from './followup.dto';

describe('FollowupRequestSchema', () => {
  it('accepts a channel and tone', () => {
    expect(FollowupRequestSchema.safeParse({ channel: 'email', tone: 'polite' }).success).toBe(
      true,
    );
  });

  it('rejects an unknown channel or tone', () => {
    expect(FollowupRequestSchema.safeParse({ channel: 'sms', tone: 'polite' }).success).toBe(false);
    expect(FollowupRequestSchema.safeParse({ channel: 'chat', tone: 'rude' }).success).toBe(false);
  });

  it('rejects extra fields', () => {
    expect(
      FollowupRequestSchema.safeParse({ channel: 'chat', tone: 'brief', userId: 'x' }).success,
    ).toBe(false);
  });
});

describe('FollowupResponseSchema', () => {
  const valid = { subject: 'Recap', body: 'Thanks all.', language: 'en' };

  it('accepts a subject or null', () => {
    expect(FollowupResponseSchema.safeParse(valid).success).toBe(true);
    expect(FollowupResponseSchema.safeParse({ ...valid, subject: null }).success).toBe(true);
  });

  it('rejects a subject over 200 characters or with a line break', () => {
    expect(FollowupResponseSchema.safeParse({ ...valid, subject: 'x'.repeat(200) }).success).toBe(
      true,
    );
    expect(FollowupResponseSchema.safeParse({ ...valid, subject: 'x'.repeat(201) }).success).toBe(
      false,
    );
    expect(FollowupResponseSchema.safeParse({ ...valid, subject: 'a\nb' }).success).toBe(false);
    expect(FollowupResponseSchema.safeParse({ ...valid, subject: 'a\rb' }).success).toBe(false);
  });

  it('rejects an empty body and extra fields', () => {
    expect(FollowupResponseSchema.safeParse({ ...valid, body: '' }).success).toBe(false);
    expect(FollowupResponseSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });
});
