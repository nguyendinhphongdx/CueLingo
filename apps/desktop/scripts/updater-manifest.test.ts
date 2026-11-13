import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = join(__dirname, 'updater-manifest.mjs');

function bundle(dir: string, name: string, signature: string): string {
  const path = join(dir, name);
  writeFileSync(path, 'bundle');
  writeFileSync(`${path}.sig`, `${signature}\n`);
  return path;
}

describe('updater-manifest', () => {
  it('writes one entry per platform with the signature next to each bundle', () => {
    const dir = mkdtempSync(join(tmpdir(), 'manifest-'));
    const mac = bundle(dir, 'CueLingo.app.tar.gz', 'mac-sig');
    const win = bundle(dir, 'CueLingo-Windows-x64-setup.exe', 'win-sig');

    const out = execFileSync(process.execPath, [
      script,
      '0.2.0',
      'darwin-aarch64',
      mac,
      'https://example.test/v0.2.0/CueLingo.app.tar.gz',
      'windows-x86_64',
      win,
      'https://example.test/v0.2.0/CueLingo-Windows-x64-setup.exe',
    ]).toString();
    const manifest = JSON.parse(out);

    expect(manifest.version).toBe('0.2.0');
    expect(manifest.platforms).toEqual({
      'darwin-aarch64': {
        signature: 'mac-sig',
        url: 'https://example.test/v0.2.0/CueLingo.app.tar.gz',
      },
      'windows-x86_64': {
        signature: 'win-sig',
        url: 'https://example.test/v0.2.0/CueLingo-Windows-x64-setup.exe',
      },
    });
  });

  it('keeps the macOS-only manifest the same shape as before', () => {
    const dir = mkdtempSync(join(tmpdir(), 'manifest-'));
    const mac = bundle(dir, 'CueLingo.app.tar.gz', 'mac-sig');

    const out = execFileSync(process.execPath, [
      script,
      '0.2.0',
      'darwin-aarch64',
      mac,
      'https://x.test/a',
    ]);

    expect(Object.keys(JSON.parse(out.toString()).platforms)).toEqual(['darwin-aarch64']);
  });

  it.each([
    [['0.2.0']],
    [['0.2.0', 'darwin-aarch64', 'b']],
    [['v0.2.0', 'darwin-aarch64', 'b', 'u']],
    [['0.2.0', 'macos', 'b', 'u']],
  ])('refuses bad arguments %j', (args) => {
    const run = spawnSync(process.execPath, [script, ...args]);
    expect(run.status).not.toBe(0);
  });
});
