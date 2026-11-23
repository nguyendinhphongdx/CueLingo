import { describe, expect, it } from 'vitest';
import { matchSessions, PREP_MAX_SESSIONS, type MatchableSession } from './match-sessions';

const session = (
  id: string,
  title: string | null,
  startedAt = '2026-11-01T09:00:00.000Z',
  language: MatchableSession['language'] = 'en',
): MatchableSession => ({ id, title, startedAt, language });

describe('matchSessions (AC2)', () => {
  it('matches the same title ignoring case and punctuation', () => {
    expect(matchSessions('Weekly Sync - Acme', [session('a', 'weekly sync, acme')], 'en')).toEqual([
      'a',
    ]);
  });

  it('matches when one title contains the other', () => {
    const sessions = [session('a', 'Acme weekly sync'), session('b', 'Budget review')];
    expect(matchSessions('Acme weekly sync (Thursday)', sessions, 'en')).toEqual(['a']);
  });

  it('suggests nothing without a match, for a vague title, an empty title or no title', () => {
    expect(matchSessions('Budget review', [session('a', 'Acme weekly sync')], 'en')).toEqual([]);
    expect(matchSessions('1:1 with Lan', [session('a', '1:1')], 'en')).toEqual([]);
    expect(matchSessions('   ', [session('a', 'Weekly sync')], 'en')).toEqual([]);
    expect(matchSessions('Weekly sync', [session('a', null), session('b', '')], 'en')).toEqual([]);
  });

  it('ignores meetings in another language', () => {
    expect(
      matchSessions('Weekly sync', [session('a', 'Weekly sync', undefined, 'ja')], 'en'),
    ).toEqual([]);
  });

  it('returns the newest five', () => {
    const sessions = Array.from({ length: 7 }, (_, index) =>
      session(`s${index}`, 'Weekly sync', `2026-11-0${index + 1}T09:00:00.000Z`),
    );
    const ids = matchSessions('Weekly sync', sessions, 'en');
    expect(ids).toHaveLength(PREP_MAX_SESSIONS);
    expect(ids[0]).toBe('s6');
  });
});
