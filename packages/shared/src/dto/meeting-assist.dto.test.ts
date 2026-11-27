import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAN_LIMITS, isDailyMetric } from '../plans';
import { AskMeetingRequestSchema, stripSourceTags } from './meeting-assist.dto';
import { ExportSessionSchema } from './privacy.dto';

describe('meeting assist contract', () => {
  it('refuses a userId or an unknown field in the question', () => {
    expect(AskMeetingRequestSchema.safeParse({ question: 'SSO là gì?' }).success).toBe(true);
    expect(AskMeetingRequestSchema.safeParse({ question: 'x', userId: 'u' }).success).toBe(false);
    expect(AskMeetingRequestSchema.safeParse({ question: '  ' }).success).toBe(false);
    expect(AskMeetingRequestSchema.safeParse({ question: 'a'.repeat(501) }).success).toBe(false);
  });

  it('removes whole and half-streamed source markers', () => {
    expect(stripSourceTags('SSO là đăng nhập một lần [1]. Thêm [G]')).toBe(
      'SSO là đăng nhập một lần. Thêm',
    );
    expect(stripSourceTags('Hạn thứ Sáu [1, 2]')).toBe('Hạn thứ Sáu');
    expect(stripSourceTags('đang chạy [1')).toBe('đang chạy');
    expect(stripSourceTags('đang chạy [')).toBe('đang chạy');
    expect(stripSourceTags('mảng [a] giữ nguyên')).toBe('mảng [a] giữ nguyên');
  });

  it('counts questions per day with an allowance on every plan', () => {
    expect(isDailyMetric('meeting_ask_daily')).toBe(true);
    expect(DEFAULT_PLAN_LIMITS.free.meeting_ask_daily).toBe(10);
    expect(DEFAULT_PLAN_LIMITS.pro.meeting_ask_daily).toBe(60);
    expect(DEFAULT_PLAN_LIMITS.ultra.meeting_ask_daily).toBe(150);
  });

  it('keeps an exported meeting without questions valid', () => {
    expect(ExportSessionSchema.shape.questions.safeParse(undefined).success).toBe(true);
  });
});
