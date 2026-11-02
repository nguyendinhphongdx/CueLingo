import { describe, expect, it } from 'vitest';
import {
  ASSIST_LEVELS,
  RULES,
  suggestAssistLevel,
  type AssistLevel,
  type MeetingOutcome,
} from './assist-dial';

const NOW = new Date('2026-11-20T09:00:00Z');
const meeting = (daysAgo: number, pct: number | null, lookups = 3): MeetingOutcome => ({
  comprehensionPct: pct,
  lookups,
  startedAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
});

describe('lowering the help', () => {
  it('suggests the next lower level after three strong meetings with few lookups', () => {
    const result = suggestAssistLevel(4, [meeting(1, 90), meeting(3, 88), meeting(5, 86)], {
      now: NOW,
    });
    expect(result).toMatchObject({
      kind: 'lower',
      suggestedLevel: 3,
      meetingsConsidered: 3,
      avgComprehensionPct: 88,
    });
  });

  it('walks down 4, 3, 1, 0 and stops at the bottom', () => {
    const strong = [meeting(1, 95), meeting(2, 95), meeting(3, 95)];
    expect(suggestAssistLevel(3, strong, { now: NOW })).toMatchObject({ suggestedLevel: 1 });
    expect(suggestAssistLevel(1, strong, { now: NOW })).toMatchObject({ suggestedLevel: 0 });
    expect(suggestAssistLevel(0, strong, { now: NOW }).kind).toBe('keep');
  });

  it('waits for three judged meetings and for every one to be good', () => {
    expect(suggestAssistLevel(4, [meeting(1, 90), meeting(2, 90)], { now: NOW }).kind).toBe('keep');
    expect(
      suggestAssistLevel(4, [meeting(1, 90), meeting(2, 84), meeting(3, 90)], { now: NOW }).kind,
    ).toBe('keep');
  });

  it('does not lower the help while the person is still leaning on the dictionary', () => {
    const busy = [meeting(1, 92, 12), meeting(2, 92, 10), meeting(3, 92, 9)];
    expect(suggestAssistLevel(4, busy, { now: NOW }).kind).toBe('keep');
  });

  it('ignores meetings the debrief could not judge', () => {
    const result = suggestAssistLevel(
      4,
      [meeting(1, null), meeting(2, 90), meeting(3, 90), meeting(4, null), meeting(5, 90)],
      { now: NOW },
    );
    expect(result.kind).toBe('lower');
  });
});

describe('offering more help', () => {
  it('suggests the next higher level after two hard meetings', () => {
    const result = suggestAssistLevel(1, [meeting(1, 40), meeting(2, 50)], { now: NOW });
    expect(result).toMatchObject({ kind: 'raise', suggestedLevel: 3, meetingsConsidered: 2 });
  });

  it('never goes above the full level and needs both meetings to be hard', () => {
    const hard = [meeting(1, 30), meeting(2, 30)];
    expect(suggestAssistLevel(4, hard, { now: NOW }).kind).toBe('keep');
    expect(suggestAssistLevel(3, [meeting(1, 30), meeting(2, 70)], { now: NOW }).kind).toBe('keep');
  });
});

describe('not nagging', () => {
  const strong = [meeting(1, 95), meeting(2, 95), meeting(3, 95)];

  it('stays quiet for a week after the person answered, either way', () => {
    const recent = new Date(NOW.getTime() - 2 * 86_400_000).toISOString();
    expect(suggestAssistLevel(4, strong, { now: NOW, lastDecisionAt: recent }).kind).toBe('keep');
  });

  it('after the wait, only meetings since the answer count', () => {
    const decided = new Date(NOW.getTime() - 8 * 86_400_000).toISOString();
    expect(suggestAssistLevel(4, strong, { now: NOW, lastDecisionAt: decided }).kind).toBe('lower');

    const fresh = [meeting(1, 95), meeting(2, 95), meeting(12, 95)];
    expect(suggestAssistLevel(4, fresh, { now: NOW, lastDecisionAt: decided }).kind).toBe('keep');
  });
});

describe('properties', () => {
  it('always returns a valid level and never suggests the level it already has', () => {
    for (const current of ASSIST_LEVELS) {
      for (let a = 0; a <= 100; a += 20) {
        for (let b = 0; b <= 100; b += 20) {
          const result = suggestAssistLevel(
            current as AssistLevel,
            [meeting(1, a), meeting(2, b), meeting(3, a)],
            { now: NOW },
          );
          if (result.kind !== 'keep') {
            expect(ASSIST_LEVELS).toContain(result.suggestedLevel);
            expect(result.suggestedLevel).not.toBe(current);
            expect(result.avgComprehensionPct).toBeGreaterThanOrEqual(0);
            expect(result.avgComprehensionPct).toBeLessThanOrEqual(100);
          }
        }
      }
    }
  });

  it('keeps its thresholds in one place', () => {
    expect(RULES.lowerAtOrAbovePct).toBeGreaterThan(RULES.raiseBelowPct);
  });
});
