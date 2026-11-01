import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/config', () => ({ GOOGLE_ENABLED: false, IS_DEV: false }));
vi.mock('./use-login', () => ({
  useLogin: () => ({
    sendLink: vi.fn(),
    sending: false,
    sent: false,
    signInWithGoogle: vi.fn(),
    error: null,
  }),
}));

import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('uses the CueLingo logo on a centered page without app navigation', () => {
    const markup = renderToStaticMarkup(<LoginPage />);

    expect(markup).toContain('aria-label="CueLingo"');
    expect(markup).toContain('min-h-screen');
    expect(markup).not.toContain('Điều hướng chính');
    expect(markup).not.toContain('Đăng xuất');
  });
});
