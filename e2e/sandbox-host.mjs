/**
 * A bare host page for `tests/assistant-sandbox.spec.ts`: embeds the sandbox runner the way `SandboxFrame` does (the
 * attributes come from the test) and records what the runner relays. Not the real chat page; that needs a login and
 * a database. Serves `/` and `/healthz` on port 3418.
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
  setInterval(function () {
    var now = performance.now();
    window.__maxGap = Math.max(window.__maxGap, now - last);
    last = now;
  }, 50);
  window.run = function (attrs, html) {
    last = performance.now();
    window.__maxGap = 0;
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

createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://host.invalid').pathname;
  if (path === '/healthz') return void res.writeHead(200).end('ok');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(PAGE);
}).listen(Number(process.env.PORT ?? 3418), '127.0.0.1');
