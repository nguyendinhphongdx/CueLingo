import { describe, expect, it } from 'vitest';
import { createSpeakerRegistry, hintsNearlyEqual } from './speaker-registry';

const fresh = () => {
  let time = 0;
  const registry = createSpeakerRegistry(() => time);
  return { registry, at: (ms: number) => (time = ms) };
};

describe('speaker registry', () => {
  it('starts empty and issues numbers in order', () => {
    const { registry, at } = fresh();
    expect(registry.known()).toEqual([]);
    expect(registry.resolve({ label: 'new', hint: 'male low' }, 'a')).toBe('speaker_1');
    at(60_000);
    expect(registry.resolve({ label: 'new', hint: 'female high' }, 'b')).toBe('speaker_2');
    expect(registry.known().map((s) => s.label)).toEqual(['speaker_1', 'speaker_2']);
  });

  it('keeps the label of a known speaker and refreshes lastText', () => {
    const { registry } = fresh();
    registry.resolve({ label: 'new', hint: 'male low' }, 'first');
    expect(registry.resolve({ label: 'speaker_1' }, 'second')).toBe('speaker_1');
    expect(registry.known()[0]).toEqual({
      label: 'speaker_1',
      hint: 'male low',
      lastText: 'second',
    });
  });

  it('gives no label for unknown, a missing verdict or a label nobody holds', () => {
    const { registry } = fresh();
    registry.resolve({ label: 'new', hint: 'x' }, 'a');
    expect(registry.resolve({ label: 'unknown' }, 'b')).toBeNull();
    expect(registry.resolve(undefined, 'c')).toBeNull();
    expect(registry.resolve({ label: 'speaker_5' }, 'd')).toBeNull();
    expect(registry.known()).toHaveLength(1);
  });

  it('caps hint and lastText', () => {
    const { registry } = fresh();
    registry.resolve({ label: 'new', hint: 'h'.repeat(90) }, 't'.repeat(500));
    const [entry] = registry.known();
    expect(entry!.hint).toHaveLength(60);
    expect(entry!.lastText).toHaveLength(200);
  });

  it('stops at eight people: a ninth new voice is "Người khác" (AC3)', () => {
    const { registry, at } = fresh();
    for (let n = 1; n <= 8; n += 1) {
      at(n * 60_000);
      expect(registry.resolve({ label: 'new', hint: `voice ${n}` }, 't')).toBe(`speaker_${n}`);
    }
    at(9 * 60_000);
    expect(registry.resolve({ label: 'new', hint: 'voice nine' }, 't')).toBeNull();
    expect(registry.known()).toHaveLength(8);
    expect(registry.resolve({ label: 'speaker_3' }, 't')).toBe('speaker_3');
  });

  it('merges a new speaker with a nearly equal hint seen within 5 seconds', () => {
    const { registry, at } = fresh();
    at(1_000);
    expect(registry.resolve({ label: 'new', hint: 'male, low pitch, fast' }, 'a')).toBe(
      'speaker_1',
    );
    at(4_000);
    expect(registry.resolve({ label: 'new', hint: 'Male low pitch' }, 'b')).toBe('speaker_1');
    expect(registry.known()).toHaveLength(1);
    expect(registry.known()[0]!.lastText).toBe('b');
  });

  it('does not merge after 5 seconds or when the hints differ', () => {
    const { registry, at } = fresh();
    at(0);
    registry.resolve({ label: 'new', hint: 'male low pitch' }, 'a');
    at(1_000);
    expect(registry.resolve({ label: 'new', hint: 'female high pitch quick' }, 'b')).toBe(
      'speaker_2',
    );
    at(7_000);
    expect(registry.resolve({ label: 'new', hint: 'female high pitch quick' }, 'c')).toBe(
      'speaker_3',
    );
  });

  it('never merges empty hints', () => {
    expect(hintsNearlyEqual('', '')).toBe(false);
    expect(hintsNearlyEqual('male low', 'male low')).toBe(true);
    expect(hintsNearlyEqual('male low', 'female high')).toBe(false);
  });

  it('known() is a copy and clear() forgets everyone', () => {
    const { registry, at } = fresh();
    registry.resolve({ label: 'new', hint: 'x' }, 'a');
    registry.known()[0]!.lastText = 'changed';
    expect(registry.known()[0]!.lastText).toBe('a');
    registry.clear();
    expect(registry.known()).toEqual([]);
    at(1);
    expect(registry.resolve({ label: 'new', hint: 'x' }, 'a')).toBe('speaker_1');
  });
});
