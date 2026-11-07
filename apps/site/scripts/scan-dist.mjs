// Scans a built static site for anything that must never be public: keys, tokens, development hosts and the
// private API/web addresses. Prints the file and the rule, never the matched value. Used by the Pages workflow.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** @type {ReadonlyArray<{ rule: string, pattern: RegExp }>} */
const RULES = [
  { rule: 'private key block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    rule: 'GitHub token',
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/,
  },
  { rule: 'cloud or API key', pattern: /\b(?:AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9_-]{20,})/ },
  { rule: 'bearer credential', pattern: /Bearer\s+[A-Za-z0-9._~+/-]{20,}/ },
  {
    rule: 'signing or release secret name',
    pattern: /TAURI_SIGNING|RELEASES_TOKEN|UPDATER_PUBKEY/,
  },
  { rule: 'development token', pattern: /dev-token|REALTIME_TOKEN/ },
  { rule: 'development host', pattern: /\blocalhost\b|127\.0\.0\.1|0\.0\.0\.0/ },
];

/** @param {string} dir @returns {string[]} */
function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

/**
 * @param {string} dir built site folder
 * @param {string[]} [forbidden] exact strings that must not appear (for example the private API URL)
 * @returns {{ file: string, rule: string }[]}
 */
export function scanDist(dir, forbidden = []) {
  const exact = forbidden.map((value) => value.trim()).filter(Boolean);
  const findings = [];
  for (const file of listFiles(dir)) {
    if (/\.(?:png|ico|woff2?)$/.test(file)) continue; // binary, not readable as text
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
  const dir = process.argv[2] ?? 'dist';
  const forbidden = (process.env.FORBIDDEN_STRINGS ?? '').split('\n');
  const findings = scanDist(dir, forbidden);
  if (findings.length > 0) {
    for (const { file, rule } of findings) console.error(`${file}: ${rule}`);
    console.error('The built site carries something that must not be public.');
    process.exit(1);
  }
  process.stdout.write(
    `Scanned ${listFiles(dir).length} files in ${dir}: nothing sensitive found.\n`,
  );
}
