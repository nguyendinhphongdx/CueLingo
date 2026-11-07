import { describe, expect, it } from 'vitest';
import config from '../../next.config';
import { assistantCsp, originOf, sandboxOriginOf } from './csp';

describe('assistantCsp', () => {
  it('allows exactly the runner origin as a frame, and only same-origin or data images', () => {
    expect(assistantCsp('http://localhost:3101')).toBe(
      "frame-src http://localhost:3101; img-src 'self' data:",
    );
    expect(assistantCsp('https://sandbox.example.com/runner.html')).toBe(
      "frame-src https://sandbox.example.com; img-src 'self' data:",
    );
  });

  it('allows no frame at all without a usable runner origin', () => {
    for (const origin of [
      undefined,
      null,
      '',
      '  ',
      'nonsense',
      'javascript:alert(1)',
      'data:text/html,x',
    ])
      expect(assistantCsp(origin)).toBe("frame-src 'none'; img-src 'self' data:");
  });

  it('never lets a value add a directive or a second source', () => {
    const csp = assistantCsp(
      "https://a.example.com; script-src 'unsafe-eval' https://b.example.com",
    );
    expect(csp).not.toContain('script-src');
    expect(csp).not.toContain('b.example.com');
    expect(originOf('https://a.example.com@evil.test')).toBe('https://evil.test');
  });
});

describe('sandboxOriginOf', () => {
  it('accepts a separate origin and refuses the API origin or an unusable value', () => {
    const api = 'http://localhost:4000';
    expect(sandboxOriginOf('http://localhost:3101', [api])).toBe('http://localhost:3101');
    expect(sandboxOriginOf('http://localhost:4000/runner.html', [api])).toBeNull();
    expect(sandboxOriginOf('https://API.example.com', ['https://api.example.com/v1'])).toBeNull();
    expect(sandboxOriginOf('nonsense', [api])).toBeNull();
    expect(sandboxOriginOf(undefined, [api])).toBeNull();
  });
});

describe('next.config headers', () => {
  it('sends the policy on every route, so a client-side navigation to /assistant keeps it', async () => {
    const rules = (await config.headers?.()) ?? [];
    expect(rules).toHaveLength(1);
    expect(rules[0]?.source).toBe('/:path*');
    const header = rules[0]?.headers.find((h) => h.key === 'Content-Security-Policy');
    expect(header?.value).toContain("img-src 'self' data:");
    expect(header?.value).toContain('frame-src');
  });
});
