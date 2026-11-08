/**
 * A bare host page for `tests/assistant-sandbox.spec.ts`: embeds the sandbox runner the way `SandboxFrame` does (the
 * attributes come from the test) and records what the runner relays. Not the real chat page; that needs a login and
 * a database. Serves `/`, `/healthz`, `/beat` and `/state` on port 3418.
 *
 * `/beat` and `/state` let a test judge the host's main thread without asking the browser anything: while a block
 * spins, every automation round trip into the page can take very long on a small runner, so the page reports its own
 * heartbeat to this server and the test reads it from here.
 */
import { createServer } from 'node:http';

const PAGE = `<!doctype html><meta charset="utf-8"><title>host</title>
<p id="alive">host page</p>
<script>
  window.__messages = [];
  window.__frame = null;
  window.addEventListener('message', function (event) {
    if (window.__frame && event.source === window.__frame.contentWindow) {
      window.__messages.push({ origin: event.origin, data: event.data });
    }
  });
  // Heartbeat of this page's own main thread: the longest gap between two ticks since the block started.
  // A frozen page cannot tick, so the gap, not the (slow) automation round trip, tells whether it froze.
  window.__maxGap = 0;
  var last = performance.now();
  var running = false;
  setInterval(function () {
    var now = performance.now();
    window.__maxGap = Math.max(window.__maxGap, now - last);
    last = now;
  }, 50);
  // Reports the heartbeat to the server that served this page; the test reads it there over plain HTTP.
  setInterval(function () {
    if (!running) return;
    var ready = window.__messages.some(function (m) { return m.data && m.data.op === 'ui.ready'; });
    fetch('/beat?maxGap=' + Math.round(window.__maxGap) + '&ready=' + (ready ? 1 : 0), { keepalive: true }).catch(function () {});
  }, 250);
  window.run = function (attrs, html) {
    last = performance.now();
    window.__maxGap = 0;
    running = true;
    var frame = document.createElement('iframe');
    frame.setAttribute('sandbox', attrs.sandbox);
    frame.setAttribute('allow', attrs.allow);
    frame.setAttribute('referrerpolicy', attrs.referrerPolicy);
    frame.src = attrs.src;
    frame.style.cssText = 'width:600px;height:200px;border:0';
    frame.addEventListener('load', function () {
      frame.contentWindow.postMessage({ v: 1, kind: 'render', html: html }, '*');
    });
    window.__frame = frame;
    document.body.appendChild(frame);
  };
</script>`;

/** What the page last reported: when (server clock), its longest tick gap so far, and whether the block said ready. */
let beat = { at: 0, count: 0, maxGap: 0, ready: false };

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://host.invalid');
  if (url.pathname === '/healthz') return void res.writeHead(200).end('ok');
  if (url.pathname === '/beat') {
    beat = {
      at: Date.now(),
      count: beat.count + 1,
      maxGap: Number(url.searchParams.get('maxGap')) || 0,
      ready: url.searchParams.get('ready') === '1',
    };
    return void res.writeHead(204).end();
  }
  if (url.pathname === '/state') {
    return void res
      .writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      .end(JSON.stringify({ ...beat, now: Date.now() }));
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(PAGE);
}).listen(Number(process.env.PORT ?? 3418), '127.0.0.1');
