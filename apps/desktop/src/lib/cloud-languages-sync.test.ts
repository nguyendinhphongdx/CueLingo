import { readFileSync } from 'node:fs';
import { SUPPORTED_LANGUAGES } from '@cuelingo/shared';
import { describe, expect, it } from 'vitest';

const swiftFile = new URL(
  '../../native/macos-audio/Sources/LocalSTT/SpeechModels.swift',
  import.meta.url,
);

describe('cloud languages', () => {
  it('are the same in the Swift sidecar and in the language registry', () => {
    const source = readFileSync(swiftFile, 'utf8');
    const match = /cloudLanguages\s*=\s*\[([^\]]*)\]/.exec(source);
    expect(match, 'cloudLanguages array not found in SpeechModels.swift').not.toBeNull();
    const swift = [...match![1]!.matchAll(/"([a-z]{2,3})"/g)].map((m) => m[1]!).sort();
    const registry = Object.entries(SUPPORTED_LANGUAGES)
      .filter(([, language]) => language.recognition === 'cloud')
      .map(([code]) => code)
      .sort();
    expect(swift).toEqual(registry);
  });
});
