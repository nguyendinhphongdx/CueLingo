import { MAX_HTML_BLOCK_BYTES } from '@cuelingo/shared';

export type HtmlCheck = { ok: true } | { ok: false; problem: string };

/**
 * Things a page must not contain. This is a secondary layer: the real boundary is the sandbox runner (separate
 * origin, `connect-src 'none'`, no `allow-same-origin`). The check exists to tell the model what to fix before the
 * user sees a stopped block, and to refuse the obvious attempts early. It can be bypassed by obfuscation
 * (`window['fe'+'tch']`); never rely on it for safety.
 */
const FORBIDDEN: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\bfetch\b/, label: 'fetch' },
  { pattern: /\bXMLHttpRequest\b/, label: 'XMLHttpRequest' },
  { pattern: /\bWebSocket\b/, label: 'WebSocket' },
  { pattern: /\bEventSource\b/, label: 'EventSource' },
  { pattern: /\bRTCPeerConnection\b/, label: 'RTCPeerConnection' },
  { pattern: /\bsendBeacon\b/, label: 'sendBeacon' },
  { pattern: /\bimportScripts\b/, label: 'importScripts' },
  { pattern: /\bimport\s*\(/, label: 'import()' },
  { pattern: /@import\b/i, label: '@import' },
  { pattern: /<\s*base\b/i, label: '<base>' },
  { pattern: /<\s*meta\b[^>]*http-equiv/i, label: '<meta http-equiv>' },
  { pattern: /<\s*(?:iframe|frame|frameset|object|embed)\b/i, label: 'iframe/object/embed' },
  {
    pattern: /\b(?:src|srcset|poster)\s*=\s*["']?\s*(?:https?:)?\/\//i,
    label: 'a src that points to a URL',
  },
  { pattern: /url\(\s*["']?\s*(?:https?:)?\/\//i, label: 'url() that points to a URL' },
];

/** Whether the page is small enough and free of what the sandbox would stop anyway. */
export function checkHtml(html: string): HtmlCheck {
  const bytes = new TextEncoder().encode(html).length;
  if (bytes > MAX_HTML_BLOCK_BYTES) {
    return { ok: false, problem: `html is ${bytes} bytes; the limit is ${MAX_HTML_BLOCK_BYTES}.` };
  }
  for (const { pattern, label } of FORBIDDEN) {
    if (pattern.test(html)) {
      return {
        ok: false,
        problem: `html uses ${label}, which is not allowed in the sandbox. Remove it and use only inline code.`,
      };
    }
  }
  return { ok: true };
}
