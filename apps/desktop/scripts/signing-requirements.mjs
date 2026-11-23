/* eslint-disable no-console -- a build script: printing is its output */
// Writes the expected designated requirements (apps/desktop/signing/*.requirement) for a signing certificate.
//   node scripts/signing-requirements.mjs <SHA-1 of the certificate>
// The SHA-1 is public (`openssl x509 -in cert.pem -noout -fingerprint -sha1`), so the files are committed.
// The release workflow compares them with what `codesign -d -r-` says about the built app and sidecar.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_IDENTIFIER = 'vn.cmcai.cuelingo';
export const SIDECAR_IDENTIFIER = 'vn.cmcai.cuelingo.audio';

/** The requirement codesign writes for a certificate that is not issued by Apple. */
export function requirementFor(identifier, sha1) {
  const hash = sha1.replace(/[^0-9a-f]/gi, '').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(hash)) throw new Error('expected a 40-digit SHA-1 hash');
  return `identifier "${identifier}" and certificate leaf = H"${hash}"`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const sha1 = process.argv[2];
  if (!sha1) {
    console.error('usage: node scripts/signing-requirements.mjs <certificate SHA-1>');
    process.exit(1);
  }
  const dir = join(dirname(fileURLToPath(import.meta.url)), '../signing');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'app.requirement'), requirementFor(APP_IDENTIFIER, sha1) + '\n');
  writeFileSync(join(dir, 'sidecar.requirement'), requirementFor(SIDECAR_IDENTIFIER, sha1) + '\n');
  console.log(`wrote ${dir}/{app,sidecar}.requirement`);
}
