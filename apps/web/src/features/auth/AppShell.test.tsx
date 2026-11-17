import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

const path = vi.hoisted(() => ({ value: '/sessions/example' }));

vi.mock('next/navigation', () => ({
  usePathname: () => path.value,
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

/** `access` is what `GET /v1/admin/me` answered; undefined = not answered yet. */
function renderShell(node: ReactElement, access?: { isAdmin: boolean }) {
  const queryClient = new QueryClient();
  if (access) queryClient.setQueryData(['admin', 'access'], access);
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
  );
}

describe('AppShell', () => {
  beforeEach(() => {
    session.value = signedIn;
    path.value = '/sessions/example';
  });

  it('renders the shared grouped sidebar with the current route and upcoming markers', () => {
    const markup = renderShell(
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
    const markup = renderShell(<AppShell>Trang</AppShell>);

    expect(markup).toContain('aria-label="Mở trình đơn"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-controls="mobile-navigation"');
    expect(markup).toContain('md:hidden');
    expect(markup).toContain('min-h-11');
  });

  it('says the server cannot be reached, with a retry, instead of sending people to sign in', () => {
    session.value = { data: null, isPending: false, error: { status: 0 }, refetch: vi.fn() };
    const markup = renderShell(<AppShell>Trang</AppShell>);

    expect(markup).toContain('Không kết nối được tới máy chủ CueLingo');
    expect(markup).toContain('Thử lại');
    expect(markup).not.toContain('Trang');
  });

  it('still waits quietly while the session is loading', () => {
    session.value = { data: null, isPending: true, error: null, refetch: vi.fn() };
    expect(renderShell(<AppShell>Trang</AppShell>)).toContain('Đang kiểm tra phiên đăng nhập');
  });

  describe('admin group', () => {
    const ADMIN_ITEMS = [
      'Tổng quan',
      'Người dùng &amp; gói',
      'Doanh thu',
      'Lượng dùng',
      'Hoạt động app',
      'Trợ lý AI',
      'Mã mời',
    ];

    it('has no Quản trị group while the API has not answered, or says the caller is not an admin', () => {
      expect(renderShell(<AppShell>Trang</AppShell>)).not.toContain('Quản trị');
      expect(renderShell(<AppShell>Trang</AppShell>, { isAdmin: false })).not.toContain('Quản trị');
      expect(renderShell(<AppShell>Trang</AppShell>, { isAdmin: false })).not.toContain('/admin');
    });

    it('shows the group last, with the 7 entries, once the API says the caller is an admin', () => {
      const markup = renderShell(<AppShell>Trang</AppShell>, { isAdmin: true });
      const start = markup.indexOf('Quản trị');
      expect(start).toBeGreaterThan(markup.indexOf('Ứng dụng'));
      const order = ADMIN_ITEMS.map((label) => markup.indexOf(`>${label}</span>`, start));
      expect(order.every((i) => i > start)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      expect(markup).toContain('href="/admin/revenue"');
    });

    /** The `<a>` of a path, or '' when there is none. */
    const link = (markup: string, href: string) =>
      markup.match(new RegExp(`<a [^>]*href="${href}"[^>]*>`))?.[0] ?? '';

    it('marks the open admin entry, and /admin only on /admin itself', () => {
      path.value = '/admin/users';
      let markup = renderShell(<AppShell>Trang</AppShell>, { isAdmin: true });
      expect(link(markup, '/admin/users')).toContain('aria-current="page"');
      expect(link(markup, '/admin')).not.toContain('aria-current');
      path.value = '/admin/users/0b9f2f5e';
      markup = renderShell(<AppShell>Trang</AppShell>, { isAdmin: true });
      expect(link(markup, '/admin/users')).toContain('aria-current="page"');
      path.value = '/admin';
      markup = renderShell(<AppShell>Trang</AppShell>, { isAdmin: true });
      expect(link(markup, '/admin')).toContain('aria-current="page"');
    });

    it('lets every page fill the content area', () => {
      const markup = renderShell(<AppShell>Trang</AppShell>);
      expect(markup).not.toContain('max-w-[640px]');
      expect(markup).toContain('w-full');
    });
  });
});
