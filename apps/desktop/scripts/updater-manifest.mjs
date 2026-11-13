// Writes the `latest.json` the Tauri updater reads, from the signed update bundles of every platform.
//
//   node scripts/updater-manifest.mjs <version> <platform> <bundle> <download-url> [<platform> <bundle> <download-url> ...] > latest.json
//
// <platform> is the updater key, e.g. `darwin-aarch64` or `windows-x86_64`. The signature is the one
// written next to each bundle (`<bundle>.sig`) with the updater private key. The app refuses a
// package whose signature does not match its public key.
import { readFileSync } from 'node:fs';

const [version, ...rest] = process.argv.slice(2);
if (!version || rest.length === 0 || rest.length % 3 !== 0) {
  console.error(
    'usage: updater-manifest.mjs <version> <platform> <bundle> <download-url> [<platform> <bundle> <download-url> ...]',
  );
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`not a plain version: ${version}`);

const platforms = {};
for (let i = 0; i < rest.length; i += 3) {
  const [platform, bundle, url] = rest.slice(i, i + 3);
  if (!/^(darwin|windows|linux)-(aarch64|x86_64)$/.test(platform)) {
    throw new Error(`not an updater platform: ${platform}`);
  }
  if (platforms[platform]) throw new Error(`platform given twice: ${platform}`);
  platforms[platform] = { signature: readFileSync(`${bundle}.sig`, 'utf8').trim(), url };
}

const manifest = {
  version,
  notes: `CueLingo ${version}`,
  pub_date: new Date().toISOString(),
  platforms,
};
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
