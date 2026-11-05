import { describe, expect, it } from 'vitest';
import { CreateFeedbackRequestSchema } from './feedback.dto';

const ok = {
  kind: 'bug',
  message: 'Caption bị trễ',
  client: 'desktop',
  appVersion: '0.1.1',
  os: 'macOS 15.1',
};

describe('feedback contract', () => {
  it('accepts what a tester types plus app and OS version', () => {
    expect(CreateFeedbackRequestSchema.parse(ok)).toEqual(ok);
  });

  it('trims the message and refuses an empty or oversized one', () => {
    expect(CreateFeedbackRequestSchema.parse({ ...ok, message: '  hi  ' }).message).toBe('hi');
    expect(CreateFeedbackRequestSchema.safeParse({ ...ok, message: '   ' }).success).toBe(false);
    expect(
      CreateFeedbackRequestSchema.safeParse({ ...ok, message: 'x'.repeat(2001) }).success,
    ).toBe(false);
    expect(
      CreateFeedbackRequestSchema.safeParse({ ...ok, message: 'x'.repeat(2000) }).success,
    ).toBe(true);
  });

  it.each(['transcript', 'audio', 'token', 'userId', 'email'])(
    'has no field to carry %s',
    (field) => {
      expect(CreateFeedbackRequestSchema.safeParse({ ...ok, [field]: 'x' }).success).toBe(false);
    },
  );

  it('only knows bug and idea, desktop and web', () => {
    expect(CreateFeedbackRequestSchema.safeParse({ ...ok, kind: 'praise' }).success).toBe(false);
    expect(CreateFeedbackRequestSchema.safeParse({ ...ok, client: 'ios' }).success).toBe(false);
  });
});
