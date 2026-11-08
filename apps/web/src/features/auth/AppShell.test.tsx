import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/sessions/example',
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('../../lib/auth-client', () => ({
  authClient: {
    useSession: () => session.value,
    signOut: vi.fn(),
  },
}));

import { AppShell } from './AppShell';

const signedIn = {
  data: { user: { name: 'Lan Anh', email: 'lan@example.com' } },
  isPending: false,
  error: null,
  refetch: vi.fn(),
};

describe('AppShell', () => {
  beforeEach(() => {
    session.value = signedIn;
  });

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

  it('says the server cannot be reached, with a retry, instead of sending people to sign in', () => {
    session.value = { data: null, isPending: false, error: { status: 0 }, refetch: vi.fn() };
    const markup = renderToStaticMarkup(<AppShell>Trang</AppShell>);

    expect(markup).toContain('Không kết nối được tới máy chủ CueLingo');
    expect(markup).toContain('Thử lại');
    expect(markup).not.toContain('Trang');
  });

  it('still waits quietly while the session is loading', () => {
    session.value = { data: null, isPending: true, error: null, refetch: vi.fn() };
    expect(renderToStaticMarkup(<AppShell>Trang</AppShell>)).toContain(
      'Đang kiểm tra phiên đăng nhập',
    );
  });
});
