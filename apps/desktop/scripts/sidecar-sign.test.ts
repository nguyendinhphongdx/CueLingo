import { describe, expect, it } from 'vitest';
import { signArguments, SIDECAR_IDENTIFIER } from './sidecar-sign.mjs';

describe('sidecar signing', () => {
  it('uses the fixed identifier, hardened runtime and the entitlements file', () => {
    const args = signArguments('bin', 'ent.plist', 'ABC123');
    expect(args).toEqual([
      '--force',
      '--options',
      'runtime',
      '--entitlements',
      'ent.plist',
      '--identifier',
      SIDECAR_IDENTIFIER,
      '--sign',
      'ABC123',
      'bin',
    ]);
    expect(SIDECAR_IDENTIFIER).toBe('vn.cmcai.cuelingo.audio');
  });

  it('falls back to an ad-hoc signature without a certificate', () => {
    expect(signArguments('bin', 'e').at(-2)).toBe('-');
    expect(signArguments('bin', 'e', '').at(-2)).toBe('-');
  });
});
