import { invoke } from '@tauri-apps/api/core';
import { describe, expect, it, vi } from 'vitest';
import { native, SessionStartInput, UtteranceEvent, Vocabulary } from './native';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn(async () => '0.1.1') }));

describe('vocabulary schema', () => {
  it('accepts 200 terms of 120 characters', () => {
    const terms = Array.from({ length: 200 }, () => 'a'.repeat(120));
    expect(Vocabulary.safeParse(terms).success).toBe(true);
    expect(SessionStartInput.safeParse({ assistLevel: 3, vocabulary: terms }).success).toBe(true);
  });

  it('rejects 201 terms, a 121-character term and an empty term', () => {
    expect(Vocabulary.safeParse(Array.from({ length: 201 }, () => 'SLA')).success).toBe(false);
    expect(Vocabulary.safeParse(['a'.repeat(121)]).success).toBe(false);
    expect(Vocabulary.safeParse(['']).success).toBe(false);
  });

  it('keeps vocabulary optional at session start', () => {
    expect(SessionStartInput.safeParse({ assistLevel: 3 }).success).toBe(true);
  });
});

describe('native.setVocabulary', () => {
  it('rejects invalid input as a promise, without calling the core', async () => {
    vi.mocked(invoke).mockClear();
    let promise: Promise<void> | undefined;
    expect(() => {
      promise = native.setVocabulary(['a'.repeat(121)]);
    }).not.toThrow();
    await expect(promise).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('sends a valid list to the core', async () => {
    await native.setVocabulary(['SLA']);
    expect(invoke).toHaveBeenCalledWith('session_set_vocabulary', { terms: ['SLA'] });
  });
});

describe('UtteranceEvent', () => {
  const valid = {
    type: 'utterance',
    segmentId: '3344ed67-4d83-4778-bcd2-41af6165755f',
    stream: 'mic',
    startMs: 0,
    endMs: 500,
    sampleRate: 16000,
    pcm: 'AAAA',
  };

  it('accepts the sidecar payload and rejects other sample rates or bad audio', () => {
    expect(UtteranceEvent.safeParse(valid).success).toBe(true);
    expect(UtteranceEvent.safeParse({ ...valid, sampleRate: 48000 }).success).toBe(false);
    expect(UtteranceEvent.safeParse({ ...valid, pcm: '***' }).success).toBe(false);
  });
});

describe('native.appInfo', () => {
  it('reports the app version and the OS family only', async () => {
    expect(await native.appInfo()).toEqual({ version: '0.1.1', os: 'macOS' });
  });
});
