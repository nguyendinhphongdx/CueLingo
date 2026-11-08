// Scans the static export (`out/`) for anything that must never be public: keys, tokens, development tokens and
// addresses of a developer machine. Prints the file and the rule, never the matched value. Same idea as
// apps/site/scripts/scan-dist.mjs; the rules differ because this app is real code, where the bare word "localhost"
// legitimately appears in library code and in help text, so only development *addresses* (host + port or path) count.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** @type {ReadonlyArray<{ rule: string, pattern: RegExp }>} */
const RULES = [
  { rule: 'private key block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    rule: 'GitHub token',
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/,
  },
  { rule: 'cloud or API key', pattern: /\b(?:AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9_-]{20,})/ },
  { rule: 'Cloudflare credential name', pattern: /CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID/ },
  {
    rule: 'signing or release secret name',
    pattern: /TAURI_SIGNING|RELEASES_TOKEN|UPDATER_PUBKEY/,
  },
  { rule: 'development token', pattern: /dev-token|REALTIME_TOKEN/ },
  {
    rule: 'development address',
    pattern: /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+|\/)/,
  },
];

/** @param {string} dir @returns {string[]} */
function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

/**
 * @param {string} dir the export folder
 * @param {string[]} [forbidden] exact strings that must not appear (for example a private address)
 * @returns {{ file: string, rule: string }[]}
 */
export function scanOut(dir, forbidden = []) {
  const exact = forbidden.map((value) => value.trim()).filter(Boolean);
  const findings = [];
  for (const file of listFiles(dir)) {
    if (/\.(?:png|jpe?g|webp|ico|woff2?)$/.test(file)) continue; // binary, not readable as text
    const text = readFileSync(file, 'utf8');
    for (const { rule, pattern } of RULES) {
      if (pattern.test(text)) findings.push({ file, rule });
    }
    for (const value of exact) {
      if (text.includes(value)) findings.push({ file, rule: 'configured private address' });
    }
  }
  return findings;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'out');
  const forbidden = (process.env.FORBIDDEN_STRINGS ?? '').split('\n');
  const findings = scanOut(dir, forbidden);
  if (findings.length > 0) {
    for (const { file, rule } of findings) console.error(`${file}: ${rule}`);
    console.error('The static export carries something that must not be public.');
    process.exit(1);
  }
  process.stdout.write(
    `Scanned ${listFiles(dir).length} files in ${dir}: nothing sensitive found.\n`,
  );
}
