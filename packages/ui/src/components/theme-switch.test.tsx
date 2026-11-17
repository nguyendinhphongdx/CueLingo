import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ThemeSwitch } from './theme-switch';

describe('ThemeSwitch', () => {
  it('offers system, light and dark, with system selected by default', () => {
    const html = renderToStaticMarkup(<ThemeSwitch />);
    expect(html).toContain('Theo hệ thống');
    expect(html).toContain('Sáng');
    expect(html).toContain('Tối');
    expect(html).toMatch(/aria-pressed="true"[^>]*>(<[^>]*>)*Theo hệ thống/);
  });
});
