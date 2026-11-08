import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanOut } from './scan-out.mjs';

const dirs: string[] = [];
function exportWith(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'web-out-'));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('scanOut', () => {
  it('passes an export that only carries the public API address', () => {
    const dir = exportWith({
      'index.html': '<p>CueLingo</p>',
      '_next/static/a.js': 'fetch("https://api.example.com/v1/phrases")',
    });
    expect(scanOut(dir)).toEqual([]);
  });

  it('allows the bare word localhost in help text and libraries', () => {
    const dir = exportWith({
      'a.js': 'cần cho phép lưu cookie của localhost; host must be "localhost"',
    });
    expect(scanOut(dir)).toEqual([]);
  });

  it('reports a key, a token, a dev token, a Cloudflare name and a development address, never the value', () => {
    const dir = exportWith({
      'a.js': '-----BEGIN PRIVATE KEY-----',
      'b.js': 'ghp_abcdefghijklmnopqrstuvwxyz0123',
      'c.js': 'x="dev-token"',
      'd.js': 'CLOUDFLARE_API_TOKEN',
      'e.js': 'fetch("http://localhost:4000/v1")',
    });
    const findings = scanOut(dir);
    expect(findings.map((f) => f.rule).sort()).toEqual([
      'Cloudflare credential name',
      'GitHub token',
      'development address',
      'development token',
      'private key block',
    ]);
    expect(JSON.stringify(findings)).not.toContain('ghp_abcdef');
  });

  it('reports a configured private address', () => {
    const dir = exportWith({ 'a.js': 'https://internal.example.org' });
    expect(scanOut(dir, ['https://internal.example.org'])).toHaveLength(1);
  });
});
