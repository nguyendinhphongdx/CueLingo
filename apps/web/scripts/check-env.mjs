// Checks the NEXT_PUBLIC_* variables before a production build. They are written into the files at build time, so a
// missing or wrong value would ship: a site that calls `localhost`, or a runner on the wrong origin. Run by
// `pnpm build:static` (always production); `--production` or NODE_ENV=production turns the required checks on.
import { pathToFileURL } from 'node:url';

/** @param {string | undefined} value */
function parseUrl(value) {
  try {
    const url = new URL((value ?? '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

const DEV_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ production: boolean }} options
 * @returns {string[]} one message per problem; empty when the build may go on
 */
export function checkEnv(env, { production }) {
  const problems = [];
  const apiRaw = env.NEXT_PUBLIC_API_URL?.trim();
  const api = parseUrl(apiRaw);

  if (production) {
    if (!apiRaw) {
      problems.push(
        'NEXT_PUBLIC_API_URL is not set. Set it to the public https address of the API (GitHub variable CUELINGO_API_URL).',
      );
    } else if (!api) {
      problems.push('NEXT_PUBLIC_API_URL must be an http(s) address.');
    } else if (DEV_HOSTS.has(api.hostname)) {
      problems.push('NEXT_PUBLIC_API_URL points at this machine; a public site cannot use it.');
    } else if (api.protocol !== 'https:') {
      problems.push('NEXT_PUBLIC_API_URL must be https in production.');
    }
  }

  const sandboxRaw = env.NEXT_PUBLIC_SANDBOX_ORIGIN?.trim();
  const sandbox = parseUrl(sandboxRaw);
  if (sandboxRaw && !sandbox)
    problems.push('NEXT_PUBLIC_SANDBOX_ORIGIN must be an http(s) origin.');
  if (sandbox && api && sandbox.origin === api.origin) {
    problems.push('NEXT_PUBLIC_SANDBOX_ORIGIN must not be the API origin.');
  }
  if (production && sandbox && DEV_HOSTS.has(sandbox.hostname)) {
    problems.push(
      'NEXT_PUBLIC_SANDBOX_ORIGIN points at this machine; a public site cannot use it.',
    );
  }
  if (env.NEXT_PUBLIC_AGENT_HTML_BLOCKS === 'true' && !sandbox) {
    problems.push(
      'NEXT_PUBLIC_AGENT_HTML_BLOCKS is true but NEXT_PUBLIC_SANDBOX_ORIGIN is not usable.',
    );
  }

  for (const name of ['NEXT_PUBLIC_GOOGLE_ENABLED', 'NEXT_PUBLIC_AGENT_HTML_BLOCKS']) {
    const value = env[name]?.trim();
    if (value && value !== 'true' && value !== 'false')
      problems.push(`${name} must be true or false.`);
  }

  const download = env.NEXT_PUBLIC_DOWNLOAD_URL?.trim();
  if (download && !parseUrl(download))
    problems.push('NEXT_PUBLIC_DOWNLOAD_URL must be an http(s) address.');

  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const production = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
  const problems = checkEnv(process.env, { production });
  if (problems.length > 0) {
    for (const problem of problems) console.error(`check-env: ${problem}`);
    process.exit(1);
  }
  process.stdout.write(`check-env: ok (${production ? 'production' : 'development'})\n`);
}
