/**
 * Static server of the sandbox runner for development and for a plain container. Production may serve
 * `runner.html` from any static host as long as it sends the headers of `headers.mjs` (see `_headers`).
 * No cookies, no storage, no API: it answers GET/HEAD for `/runner.html` (also `/`) and `/healthz`.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runnerHeaders } from './headers.mjs';

const RUNNER_HTML = readFileSync(fileURLToPath(new URL('./runner.html', import.meta.url)));

/**
 * The request handler, apart from the server so a test can call it without opening a port.
 * @param {{ frameAncestors?: string }} [options]
 * @returns {(req: { method?: string, url?: string }, res: import('node:http').ServerResponse) => void}
 */
export function createRunnerHandler(options = {}) {
  const headers = runnerHeaders(options);
  return (req, res) => {
    const send = (status, body, type) => {
      res.writeHead(status, { ...headers, 'Content-Type': type });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return send(405, 'Method Not Allowed', 'text/plain; charset=utf-8');
    }
    const path = new URL(req.url ?? '/', 'http://runner.invalid').pathname;
    if (path === '/healthz') return send(200, 'ok', 'text/plain; charset=utf-8');
    if (path === '/' || path === '/runner.html') {
      return send(200, RUNNER_HTML, 'text/html; charset=utf-8');
    }
    return send(404, 'Not Found', 'text/plain; charset=utf-8');
  };
}

/** @param {{ frameAncestors?: string }} [options] */
export function createRunnerServer(options = {}) {
  return createServer(createRunnerHandler(options));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3101);
  const host = process.env.HOST ?? '127.0.0.1';
  const frameAncestors = process.env.RUNNER_FRAME_ANCESTORS ?? '';
  createRunnerServer({ frameAncestors }).listen(port, host, () => {
    console.error(
      `sandbox-runner on http://${host}:${port} (frame-ancestors: ${frameAncestors || 'none'})`,
    );
  });
}
