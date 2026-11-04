import { describe, expect, it } from 'vitest';
import { speakerDisplayName, speakerNumber } from './speaker';

describe('speakerDisplayName', () => {
  it('shows "Tôi" for me and for an unlabelled microphone sentence', () => {
    expect(speakerDisplayName({ label: 'me', source: 'mic' })).toBe('Tôi');
    expect(speakerDisplayName({ label: null, source: 'mic' })).toBe('Tôi');
    expect(speakerDisplayName({ source: 'mic' })).toBe('Tôi');
  });

  it('prefers the name the user set, trimmed', () => {
    expect(speakerDisplayName({ label: 'speaker_2', displayName: ' Lan ', source: 'system' })).toBe(
      'Lan',
    );
  });

  it('falls back to "Speaker N", then "Người khác"', () => {
    expect(speakerDisplayName({ label: 'speaker_3', displayName: '', source: 'system' })).toBe(
      'Speaker 3',
    );
    expect(speakerDisplayName({ label: null, source: 'system' })).toBe('Người khác');
    expect(speakerDisplayName({ label: 'bogus', source: 'system' })).toBe('Người khác');
  });

  it('reads N from the label only', () => {
    expect(speakerNumber('speaker_8')).toBe(8);
    expect(speakerNumber('speaker_9')).toBeNull();
    expect(speakerNumber('me')).toBeNull();
  });
});
