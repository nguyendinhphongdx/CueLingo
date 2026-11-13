/* eslint-disable no-console -- a build script: printing is its output */
// Packs the Windows build into CueLingo-Windows-x64-setup.exe with Inno Setup (ADR 0021).
//
//   node scripts/windows-installer.mjs [--out <dir>]
//
// Run after `tauri build --no-bundle` on Windows. Needs ISCC.exe (Inno Setup 6) on PATH, in
// %ProgramFiles(x86)%\Inno Setup 6, or in INNO_SETUP_ISCC.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outDir = resolve(outIndex >= 0 ? args[outIndex + 1] : join(root, 'release-files'));

const version = JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json'), 'utf8')).version;
const triple = 'x86_64-pc-windows-msvc';

// `tauri build --no-bundle` names the exe after the product or the Cargo package, depending on the CLI.
const releaseDir = join(root, 'src-tauri/target/release');
const appExe = ['CueLingo.exe', 'cuelingo.exe']
  .map((name) => join(releaseDir, name))
  .find((path) => existsSync(path));
if (!appExe) throw new Error(`no app exe in ${releaseDir}: run tauri build --no-bundle first`);

const sidecarExe = join(root, `src-tauri/binaries/cuelingo-audio-${triple}.exe`);
if (!existsSync(sidecarExe))
  throw new Error(`no sidecar at ${sidecarExe}: run scripts/sidecar.mjs`);

const iscc =
  [
    process.env.INNO_SETUP_ISCC,
    join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Inno Setup 6', 'ISCC.exe'),
    join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Inno Setup 6', 'ISCC.exe'),
  ].find((path) => path && existsSync(path)) ?? 'ISCC.exe';

const script = join(root, 'installer/windows/CueLingo.iss');
console.log(`installer: ${iscc} ${script} (version ${version})`);
const run = spawnSync(
  iscc,
  [
    `/DAppVersion=${version}`,
    `/DAppExe=${appExe}`,
    `/DSidecarExe=${sidecarExe}`,
    `/DOutputDir=${outDir}`,
    script,
  ],
  { stdio: 'inherit' },
);
if (run.error) throw run.error;
if (run.status !== 0) process.exit(run.status ?? 1);

const setup = join(outDir, 'CueLingo-Windows-x64-setup.exe');
if (!existsSync(setup)) throw new Error(`ISCC finished but ${setup} is missing`);
console.log(`installer: ${setup}`);
