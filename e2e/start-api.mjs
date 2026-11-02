// Starts the API for the end-to-end run and copies each magic link it prints to a file the tests read.
// The dev mailer prints `[dev mailer] magic link for <email>: <url>`; nothing else is needed from the product.
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const linksFile = join(here, '.mail', 'links.jsonl');
mkdirSync(dirname(linksFile), { recursive: true });
writeFileSync(linksFile, '');

const api = spawn('pnpm', ['--filter', '@cuelingo/api', 'start'], {
  cwd: root,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

const capture = (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  for (const line of text.split('\n')) {
    const match = /\[dev mailer\] magic link for (\S+): (\S+)/.exec(line);
    if (match) appendFileSync(linksFile, JSON.stringify({ email: match[1], url: match[2] }) + '\n');
  }
};
api.stdout.on('data', capture);
api.stderr.on('data', capture);
api.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => api.kill(signal));
