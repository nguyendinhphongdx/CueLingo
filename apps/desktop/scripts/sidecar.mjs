/* eslint-disable no-console -- a build script: printing is its output */
// Builds the audio sidecar (Swift on macOS, Rust on Windows) and puts it where Tauri bundles it from.
//
//   node scripts/sidecar.mjs            build only when the binary is missing (used before tauri dev/build)
//   node scripts/sidecar.mjs --rebuild  always rebuild (used for a release)
//   node scripts/sidecar.mjs --placeholder  write an empty stand-in (CI jobs that only compile Rust)
//
// On macOS the sidecar is signed here with a fixed identifier (vn.cmcai.cuelingo.audio) and the audio entitlements.
// CUELINGO_SIGN_IDENTITY picks the certificate (a SHA-1 from `security find-identity`); without it the signature
// is ad-hoc, which is what a dev build and a build without the signing secrets get.
//
// Tauri's `externalBin` wants `binaries/cuelingo-audio-<target triple>[.exe]`; in the app it lands next to the
// app executable (Contents/MacOS/cuelingo-audio, or cuelingo-audio.exe), which is where `audio_bridge.rs` looks first.
import { spawnSync } from 'node:child_process';
import { signSidecar } from './sidecar-sign.mjs';
import { chmodSync, copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const swiftDir = join(root, 'native/macos-audio');
const windowsDir = join(root, 'native/windows-audio');
const outDir = join(root, 'src-tauri/binaries');

const host = spawnSync('rustc', ['-vV'], { encoding: 'utf8' }).stdout.match(/host: (\S+)/)?.[1];
if (!host) throw new Error('rustc is needed to find the target triple');
const windows = host.includes('windows');
const exe = windows ? '.exe' : '';
const target = join(outDir, `cuelingo-audio-${host}${exe}`);
const args = process.argv.slice(2);

mkdirSync(outDir, { recursive: true });

if (args.includes('--placeholder')) {
  if (!existsSync(target)) writeFileSync(target, '#!/bin/sh\nexit 1\n');
  chmodSync(target, 0o755);
  console.log(`sidecar: placeholder at ${target}`);
  process.exit(0);
}

if (existsSync(target) && !args.includes('--rebuild')) {
  signSidecar(target, root, windows);
  console.log(`sidecar: using ${target}`);
  process.exit(0);
}

const [tool, toolArgs, built] = windows
  ? [
      'cargo',
      ['build', '--release', '--locked', '--manifest-path', join(windowsDir, 'Cargo.toml')],
      join(windowsDir, 'target/release/cuelingo-audio.exe'),
    ]
  : [
      'swift',
      ['build', '-c', 'release', '--package-path', swiftDir],
      join(swiftDir, '.build/release/cuelingo-audio'),
    ];
console.log(`sidecar: building with ${tool} (release)…`);
// Cargo reads `.cargo/config.toml` from the working directory, and the Windows crate needs its (static C runtime).
const build = spawnSync(tool, toolArgs, {
  stdio: 'inherit',
  cwd: windows ? windowsDir : undefined,
});
if (build.status !== 0) process.exit(build.status ?? 1);

copyFileSync(built, target);
chmodSync(target, 0o755);
signSidecar(target, root, windows);
console.log(`sidecar: ${target}`);
