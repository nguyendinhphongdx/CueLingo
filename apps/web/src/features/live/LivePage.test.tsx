import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LivePage } from './LivePage';

describe('LivePage', () => {
  it('renders the web coming-soon state and macOS guidance', () => {
    const markup = renderToStaticMarkup(<LivePage />);

    expect(markup).toContain('Phiên họp');
    expect(markup).toContain('Sắp ra mắt');
    expect(markup).toContain('Phiên họp trực tiếp chạy trong app macOS CueLingo');
  });
});
