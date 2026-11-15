import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const path = vi.hoisted(() => ({ value: '/admin/users' as string | null }));
vi.mock('next/navigation', () => ({ usePathname: () => path.value, notFound: vi.fn() }));

import { AdminFrame } from './AdminFrame';
import { AdminNav, isCurrent } from './AdminNav';

const hrefs = (markup: string) => [...markup.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

describe('AdminNav', () => {
  it('links the four admin screens (AC9)', () => {
    const markup = renderToStaticMarkup(<AdminNav pathname="/admin/metrics" />);
    expect(hrefs(markup)).toEqual([
      '/admin/users',
      '/admin/metrics',
      '/admin/invites',
      '/admin/agent',
    ]);
    for (const label of ['Người dùng', 'Số liệu', 'Mã mời', 'Trợ lý AI']) {
      expect(markup).toContain(label);
    }
  });

  it('marks only the current page, and keeps the list active on a person page', () => {
    const current = (pathname: string) =>
      [...renderToStaticMarkup(<AdminNav pathname={pathname} />).matchAll(/<a [^>]*>/g)]
        .map((m) => m[0])
        .filter((tag) => tag.includes('aria-current="page"'))
        .map((tag) => /href="([^"]+)"/.exec(tag)?.[1]);
    expect(current('/admin/metrics')).toEqual(['/admin/metrics']);
    expect(current('/admin/users/')).toEqual(['/admin/users']);
    expect(current('/admin/users/0b9f')).toEqual(['/admin/users']);
    expect(current('/admin/agent')).toEqual(['/admin/agent']);
    expect(current('/sessions')).toEqual([]);
    expect(isCurrent(null, '/admin/users')).toBe(false);
    expect(isCurrent('/admin/usersx', '/admin/users')).toBe(false);
  });
});

describe('AdminFrame', () => {
  it('shows the nav around the page once the caller is known to be an admin', () => {
    path.value = '/admin/invites';
    const markup = renderToStaticMarkup(<AdminFrame>Nội dung</AdminFrame>);
    expect(markup).toContain('aria-label="Quản trị"');
    expect(markup).toContain('Nội dung');
    expect(markup).toContain('max-w-4xl');
    expect(renderToStaticMarkup(<AdminFrame width="wide">x</AdminFrame>)).toContain('max-w-6xl');
  });

  it('renders no nav before that, so a stranger never sees the links (AC7)', () => {
    const markup = renderToStaticMarkup(<AdminFrame nav={false}>Đang tải…</AdminFrame>);
    expect(markup).not.toContain('/admin/');
    expect(markup).not.toContain('Quản trị');
    expect(markup).toContain('Đang tải…');
  });
});
