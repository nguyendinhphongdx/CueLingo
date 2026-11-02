import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/auth-client', () => ({ authClient: { getSession: vi.fn() } }));
vi.mock('../../lib/client', () => ({ client: { device: { createCode: vi.fn() } } }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppAuthPage, appLink } from './AppAuthPage';

describe('AppAuthPage', () => {
  it('builds the link the desktop app registers', () => {
    expect(appLink('abc_DEF-123')).toBe('cuelingo://auth?code=abc_DEF-123');
    expect(appLink('a b')).toBe('cuelingo://auth?code=a%20b');
  });

  it('starts by checking the session and does not navigate away on its own', () => {
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <AppAuthPage />
      </QueryClientProvider>,
    );

    expect(markup).toContain('Đang kiểm tra đăng nhập');
    expect(markup).not.toContain('Gửi liên kết đăng nhập mới');
  });
});
