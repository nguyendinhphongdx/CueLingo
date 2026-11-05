// Writes the `latest.json` the Tauri updater reads, from the signed update bundle.
//
//   node scripts/updater-manifest.mjs <version> <bundle.app.tar.gz> <download-url> > latest.json
//
// The signature is the one `tauri build` wrote next to the bundle (`<bundle>.sig`), made with the
// updater private key. The app refuses a package whose signature does not match its public key.
import { readFileSync } from 'node:fs';

const [version, bundle, url] = process.argv.slice(2);
if (!version || !bundle || !url) {
  console.error('usage: updater-manifest.mjs <version> <bundle> <download-url>');
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`not a plain version: ${version}`);

const signature = readFileSync(`${bundle}.sig`, 'utf8').trim();
const manifest = {
  version,
  notes: `CueLingo ${version}`,
  pub_date: new Date().toISOString(),
  platforms: { 'darwin-aarch64': { signature, url } },
};
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
