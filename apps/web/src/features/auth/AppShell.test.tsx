import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/sessions/example',
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('../../lib/auth-client', () => ({
  authClient: {
    useSession: () => ({
      data: { user: { name: 'Lan Anh', email: 'lan@example.com' } },
      isPending: false,
    }),
    signOut: vi.fn(),
  },
}));

import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('renders the shared grouped sidebar with the current route and upcoming markers', () => {
    const markup = renderToStaticMarkup(
      <AppShell>
        <p>Nội dung trang</p>
      </AppShell>,
    );

    for (const group of ['Họp', 'Học', 'Ứng dụng']) expect(markup).toContain(group);
    expect(markup).toContain('href="/sessions"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('Sắp ra mắt');
    expect(markup).toContain('overflow-y-auto');
    expect(markup).toContain('Lan Anh');
    expect(markup).not.toContain('title="lan@example.com"');
  });

  it('renders an accessible compact navigation trigger below the md breakpoint', () => {
    const markup = renderToStaticMarkup(<AppShell>Trang</AppShell>);

    expect(markup).toContain('aria-label="Mở trình đơn"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-controls="mobile-navigation"');
    expect(markup).toContain('md:hidden');
    expect(markup).toContain('min-h-11');
  });
});
