import { describe, expect, it } from 'vitest';
import { requirementFor } from './signing-requirements.mjs';

describe('requirementFor', () => {
  const sha1 = 'AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01';

  it('writes the requirement for a self-signed certificate, hash in lower case', () => {
    expect(requirementFor('vn.cmcai.cuelingo', sha1)).toBe(
      'identifier "vn.cmcai.cuelingo" and certificate leaf = H"abcdef0123456789abcdef0123456789abcdef01"',
    );
  });

  it('rejects anything that is not a SHA-1', () => {
    expect(() => requirementFor('x', 'abc')).toThrow();
  });
});
