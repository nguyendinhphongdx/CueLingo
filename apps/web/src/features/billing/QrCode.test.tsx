import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QrCode } from './QrCode';

describe('QrCode', () => {
  it('draws the payload as inline SVG with no image request (fits img-src self data:)', () => {
    const markup = renderToStaticMarkup(
      <QrCode value="00020101021238570010A000000727" label="QR" />,
    );
    expect(markup).toContain('<svg');
    expect(markup).toContain('aria-label="QR"');
    expect(markup).toContain('<path d="M');
    expect(markup).not.toContain('<img');
    expect(markup).not.toContain('http');
  });

  it('draws nothing for a payload too long for a QR code', () => {
    expect(renderToStaticMarkup(<QrCode value={'x'.repeat(8000)} label="QR" />)).toBe('');
  });
});
