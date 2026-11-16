/* eslint-disable no-console -- a build script: printing is its output */
// Signs the macOS audio sidecar with a fixed identifier and the audio entitlements, so its signature stays the same
// from one build to the next and macOS keeps the permissions it was given (ADR 0023).
import { spawnSync } from 'node:child_process';
import { closeSync, openSync, readSync } from 'node:fs';
import { join } from 'node:path';

export const SIDECAR_IDENTIFIER = 'vn.cmcai.cuelingo.audio';

/** The codesign arguments for the sidecar; `identity` is a certificate SHA-1, or `-` for an ad-hoc signature. */
export function signArguments(target, entitlements, identity = '-') {
  return [
    '--force',
    '--options',
    'runtime',
    '--entitlements',
    entitlements,
    '--identifier',
    SIDECAR_IDENTIFIER,
    '--sign',
    identity || '-',
    target,
  ];
}

/** The CI placeholder is a shell script, not a Mach-O binary: there is nothing to sign. */
function isPlaceholder(target) {
  const fd = openSync(target, 'r');
  try {
    const head = Buffer.alloc(2);
    readSync(fd, head, 0, 2, 0);
    return head.toString() === '#!';
  } finally {
    closeSync(fd);
  }
}

/** Signs `target` on macOS; does nothing elsewhere or for the placeholder stand-in. Fails the build on a codesign error. */
export function signSidecar(target, root, windows, env = process.env) {
  if (windows || process.platform !== 'darwin' || isPlaceholder(target)) return;
  const identity = env.CUELINGO_SIGN_IDENTITY || '-';
  const entitlements = join(root, 'native/macos-audio/Sidecar.entitlements');
  const result = spawnSync('codesign', signArguments(target, entitlements, identity), {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error('sidecar: codesign failed');
    process.exit(result.status ?? 1);
  }
  console.log(
    `sidecar: signed ${SIDECAR_IDENTIFIER} (${identity === '-' ? 'ad-hoc' : 'certificate ' + identity})`,
  );
}
