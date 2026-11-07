import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanDist } from './scan-dist.mjs';

const dirs: string[] = [];

function site(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'site-scan-'));
  dirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('scanDist', () => {
  it('passes a clean site', () => {
    const dir = site({
      'index.html':
        '<a href="https://github.com/acme/r/releases/latest/download/CueLingo-macOS-arm64.dmg">x</a>',
      'assets/app.js': 'console.log("hello")',
    });

    expect(scanDist(dir, ['https://api.private.example'])).toEqual([]);
  });

  it('flags keys, tokens and development hosts, naming the file and the rule', () => {
    const dir = site({
      'a.js': '"-----BEGIN PRIVATE KEY-----"',
      'b.js': 'const t = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";',
      'c.js': 'fetch("http://localhost:4000/v1/x")',
      'd.js': 'const VITE_REALTIME_TOKEN = 1',
    });

    const rules = scanDist(dir).map((f) => f.rule);

    expect(rules).toContain('private key block');
    expect(rules).toContain('GitHub token');
    expect(rules).toContain('development host');
    expect(rules).toContain('development token');
  });

  it('flags a configured private address and never echoes the matched value', () => {
    const dir = site({ 'assets/app.js': 'x("https://api.private.example/v1")' });

    const findings = scanDist(dir, ['https://api.private.example', '']);

    expect(findings).toHaveLength(1);
    expect(JSON.stringify(findings)).not.toContain('api.private.example');
  });
});
