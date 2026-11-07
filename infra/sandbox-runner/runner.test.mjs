import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CSP_DIRECTIVES, runnerHeaders } from './headers.mjs';
import { createRunnerHandler } from './server.mjs';

const here = (name) => new URL(`./${name}`, import.meta.url);

describe('runner headers', () => {
  const headers = runnerHeaders({ frameAncestors: 'https://app.example.com' });
  const csp = headers['Content-Security-Policy'].split('; ');

  it('denies everything by default and closes the network, forms and base URL', () => {
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("base-uri 'none'");
    // No frame of any kind: the nested page is built from srcdoc, which frame-src does not govern.
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("child-src 'none'");
    expect(csp).toContain("prefetch-src 'none'");
    expect(csp).toContain("worker-src 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('img-src data: blob:');
    expect(csp).toContain("script-src 'unsafe-inline'");
    // No directive may allow a host or a wildcard.
    expect(headers['Content-Security-Policy'].replace(/frame-ancestors .*$/, '')).not.toMatch(
      /https?:|\*/,
    );
  });

  it('keeps the document isolated and unsniffable', () => {
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(headers['Cross-Origin-Resource-Policy']).toBe('same-origin');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('no-referrer');
    expect(headers['X-DNS-Prefetch-Control']).toBe('off');
    expect(headers['Permissions-Policy']).toContain('camera=()');
    expect(headers['Permissions-Policy']).toContain('microphone=()');
  });

  it('lets only the named web origins embed it, and nobody when none is set', () => {
    expect(headers['Content-Security-Policy']).toContain('frame-ancestors https://app.example.com');
    expect(runnerHeaders()['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(runnerHeaders({ frameAncestors: '  ' })['Content-Security-Policy']).toContain(
      "frame-ancestors 'none'",
    );
  });

  it('is repeated in _headers for static hosts, value for value', () => {
    const file = readFileSync(here('_headers'), 'utf8');
    const lines = Object.fromEntries(
      file
        .split('\n')
        .filter((line) => /^\s+[A-Za-z-]+: /.test(line))
        .map((line) => {
          const [name, ...value] = line.trim().split(': ');
          return [name, value.join(': ')];
        }),
    );
    const expected = runnerHeaders({ frameAncestors: 'https://app.example.com' });
    expect(lines).toEqual(expected);
    expect(CSP_DIRECTIVES.every((d) => lines['Content-Security-Policy'].includes(d))).toBe(true);
  });
});

describe('runner.html', () => {
  const source = readFileSync(here('runner.html'), 'utf8');
  // The comment explains what is left out, so the checks read the markup without it.
  const html = source.replace(/<!--[\s\S]*?-->/g, '');

  it('is one inline script: the policy has no source for an external one', () => {
    // The nested page's own `<script>` is built inside a string, so only line-leading tags count.
    expect(html.match(/^\s*<script/gm)).toHaveLength(1);
    expect(html).not.toMatch(/<script[^>]*\ssrc=/i);
    expect(html).not.toMatch(/<link\b/i);
  });

  it('nests the page with sandbox="allow-scripts" and nothing more', () => {
    expect(html).toContain("frame.setAttribute('sandbox', 'allow-scripts')");
    expect(html).not.toContain('allow-same-origin');
    expect(html).not.toContain('allow-top-navigation');
    expect(html).not.toContain('allow-popups');
    expect(html).not.toContain('allow-forms');
    expect(html).toContain("frame.setAttribute('allow', '')");
  });

  it('relays only the six allowed operations and checks who sent each message', () => {
    for (const op of [
      'ui.resize',
      'ui.ready',
      'ui.error',
      'phrases.list',
      'phrases.save',
      'tts.speak',
    ])
      expect(html).toContain(`'${op}': 1`);
    expect(html).toContain('event.source === host');
    expect(html).toContain('event.source === frame.contentWindow');
    expect(html).toContain('MAX_HTML_BYTES = 64 * 1024');
    expect(html).toContain('MAX_MESSAGE_BYTES = 16 * 1024');
  });

  it('puts a meta policy and the DNS prefetch switch in front of the nested page, then the bootstrap', () => {
    const at = (needle) => html.indexOf(needle);
    expect(at('NESTED_CSP =')).toBeGreaterThan(-1);
    expect(html).toContain(`var NESTED_CSP = "frame-src 'none'; child-src 'none'"`);
    expect(at('http-equiv="Content-Security-Policy"')).toBeLessThan(at("<script>(' +"));
    expect(html).toContain('http-equiv="x-dns-prefetch-control" content="off"');
  });

  it('locks the WebRTC constructors and refuses pages with a link element', () => {
    for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel'])
      expect(html).toContain(`'${name}'`);
    expect(html).toContain('configurable: false');
    expect(html).toContain('hasLink(html)');
    expect(html).toContain('DOMParser');
  });

  it('does not use the network or storage itself', () => {
    expect(html).not.toMatch(
      /\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie)\b/,
    );
  });
});

describe('runner handler', () => {
  /** Calls the handler with a fake response; no port is opened. */
  function call(method, url, options) {
    const out = { status: 0, headers: {}, body: undefined };
    const res = {
      setHeader: (name, value) => (out.headers[name.toLowerCase()] = value),
      writeHead: (status, headers) => {
        out.status = status;
        for (const [name, value] of Object.entries(headers))
          out.headers[name.toLowerCase()] = value;
      },
      end: (body) => (out.body = body),
    };
    createRunnerHandler(options)({ method, url }, res);
    return out;
  }

  it('serves runner.html with the security headers, and no cookie', () => {
    const res = call('GET', '/runner.html', { frameAncestors: 'http://localhost:3000' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(res.headers['content-security-policy']).toContain("connect-src 'none'");
    expect(res.headers['content-security-policy']).toContain(
      'frame-ancestors http://localhost:3000',
    );
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(String(res.body)).toContain('CueLingo sandbox runner');
    expect(call('GET', '/').status).toBe(200);
  });

  it('sends the same headers on errors, answers only GET and HEAD, and serves nothing else', () => {
    const missing = call('GET', '/../../.env');
    expect(missing.status).toBe(404);
    expect(missing.headers['content-security-policy']).toContain("default-src 'none'");
    expect(call('GET', '/server.mjs').status).toBe(404);
    expect(call('GET', '/runner.html/../../etc/passwd').status).toBe(404);
    expect(call('POST', '/runner.html').status).toBe(405);
    expect(call('POST', '/runner.html').headers.allow).toBe('GET, HEAD');
    const head = call('HEAD', '/runner.html');
    expect(head.status).toBe(200);
    expect(head.body).toBeUndefined();
    expect(call('GET', '/healthz').status).toBe(200);
  });
});
