import { describe, expect, it } from 'vitest';
import {
  daysLeft,
  deadlineLabel,
  describeGoalLevel,
  lessonErrorMessage,
  shuffledOrder,
  voiceForSpeaker,
} from './goal-lesson';

describe('voiceForSpeaker', () => {
  it('gives each role one fixed voice', () => {
    expect(voiceForSpeaker('a')).toBe('Kore');
    expect(voiceForSpeaker('b')).toBe('Puck');
  });
});

describe('deadline helpers', () => {
  it('writes a deadline as a Vietnamese date and nothing without one', () => {
    expect(deadlineLabel('2026-12-01')).toBe('Hạn 01/12/2026');
    expect(deadlineLabel(null)).toBe('');
  });
  it('counts whole days, negative after the deadline', () => {
    expect(daysLeft('2026-12-01', '2026-11-22')).toBe(9);
    expect(daysLeft('2026-11-20', '2026-11-22')).toBe(-2);
    expect(daysLeft(null, '2026-11-22')).toBeNull();
  });
  it('names levels', () => {
    expect(describeGoalLevel('b2')).toBe('Trung cao (B2)');
    expect(describeGoalLevel('x')).toBe('X');
  });
});

describe('shuffledOrder', () => {
  it('is a permutation, the same for the same seed and different across seeds', () => {
    const order = shuffledOrder(4, 3);
    expect([...order].sort()).toEqual([0, 1, 2, 3]);
    expect(shuffledOrder(4, 3)).toEqual(order);
    const orders = new Set([1, 2, 3, 4, 5, 6].map((seed) => shuffledOrder(4, seed).join()));
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe('lessonErrorMessage (AC9)', () => {
  it('says new lessons are not made yet and that opened ones still work', () => {
    const text = lessonErrorMessage({ status: 502, code: 'LESSON_FAILED' }, 'open');
    expect(text).toContain('Bài mới chưa soạn được');
    expect(text).toContain('không bị tính vào hạn mức');
  });
  it('tells the person the daily allowance is used up', () => {
    const text = lessonErrorMessage({
      status: 429,
      code: 'QUOTA_EXCEEDED',
      details: { metric: 'lessons_daily', resetsAt: '2026-11-23T17:00:00.000Z' },
    });
    expect(text).toContain('lượt mở bài học mới hôm nay');
    expect(text).toContain('Ngày mai sẽ được làm mới');
  });
  it('has wording for the other failures and a fallback', () => {
    expect(lessonErrorMessage({ code: 'RATE_LIMITED' }, 'practice')).toContain('đợi một chút');
    expect(lessonErrorMessage({ code: 'CONFLICT' }, 'goal')).toContain('3 mục tiêu');
    expect(lessonErrorMessage({ code: 'LESSON_FAILED' }, 'practice')).toContain('Chưa góp ý được');
    expect(lessonErrorMessage(undefined, 'quiz')).toContain('Chưa nộp được');
  });
});
