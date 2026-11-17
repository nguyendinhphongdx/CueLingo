// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLAPSED_GROUPS_KEY } from '../hooks/use-collapsed-groups';
import { SidebarNav, type NavGroup, type SidebarNavProps } from './sidebar-nav';

const ADMIN: NavGroup = {
  id: 'admin',
  title: 'Quản trị',
  items: [
    { id: 'admin-overview', label: 'Tổng quan', icon: 'dashboard', webPath: '/admin' },
    { id: 'admin-users', label: 'Người dùng & gói', icon: 'users', webPath: '/admin/users' },
    { id: 'admin-revenue', label: 'Doanh thu', icon: 'revenue', webPath: '/admin/revenue' },
    { id: 'admin-usage', label: 'Lượng dùng', icon: 'usage', webPath: '/admin/usage' },
    { id: 'admin-activity', label: 'Hoạt động app', icon: 'activity', webPath: '/admin/metrics' },
    { id: 'admin-agent', label: 'Trợ lý AI ', icon: 'assistant', webPath: '/admin/agent' },
    { id: 'admin-invites', label: 'Mã mời', icon: 'invites', webPath: '/admin/invites' },
  ],
};

function setup(props: Partial<SidebarNavProps> = {}) {
  return render(
    <SidebarNav
      brand={<span>CueLingo</span>}
      activeId="meetings"
      client="web"
      renderItem={(item, { className, children, active, onSelect }) => (
        <a
          href={item.webPath}
          className={className}
          aria-current={active ? 'page' : undefined}
          onClick={onSelect}
        >
          {children}
        </a>
      )}
      {...props}
    />,
  );
}
const header = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  window.localStorage.clear();
  // jsdom has no matchMedia, which the highlight primitive reads.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SidebarNav groups', () => {
  describe('collapse', () => {
    it.each(['web', 'desktop'] as const)(
      'folds and unfolds a group from its title on the %s client, with aria-expanded and aria-controls',
      (client) => {
        setup({ client });
        const learn = header('Học');
        expect(learn.getAttribute('aria-expanded')).toBe('true');
        const list = document.getElementById(learn.getAttribute('aria-controls')!)!;
        expect(within(list).getByRole('link', { name: /Ôn tập/ })).toBeTruthy();

        fireEvent.click(learn);
        expect(learn.getAttribute('aria-expanded')).toBe('false');
        expect(list.hidden).toBe(true);
        // Hidden entries leave the accessibility tree.
        expect(screen.queryByRole('link', { name: /Ôn tập/ })).toBeNull();
        expect(screen.getByRole('link', { name: /Cuộc họp/ })).toBeTruthy();

        fireEvent.click(learn);
        expect(learn.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByRole('link', { name: /Ôn tập/ })).toBeTruthy();
      },
    );

    it('uses a native button, so Enter and Space fold it', () => {
      setup();
      expect(header('Học').tagName).toBe('BUTTON');
      expect(header('Học').getAttribute('type')).toBe('button');
    });
  });

  describe('persist', () => {
    it('remembers the folded groups on this device', () => {
      const first = setup();
      fireEvent.click(header('Học'));
      expect(JSON.parse(window.localStorage.getItem(COLLAPSED_GROUPS_KEY)!)).toEqual(['learn']);
      first.unmount();
      setup();
      expect(header('Học').getAttribute('aria-expanded')).toBe('false');
      expect(header('Họp').getAttribute('aria-expanded')).toBe('true');
    });

    it('ignores a broken value and ids of groups that are not shown', () => {
      window.localStorage.setItem(COLLAPSED_GROUPS_KEY, '{not json');
      setup();
      expect(header('Học').getAttribute('aria-expanded')).toBe('true');
      cleanup();
      window.localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([3, null, 'gone', 'learn']));
      setup();
      expect(header('Học').getAttribute('aria-expanded')).toBe('false');
    });

    it('keeps working when storage throws', () => {
      const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      const put = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      setup();
      fireEvent.click(header('Học'));
      expect(header('Học').getAttribute('aria-expanded')).toBe('false');
      get.mockRestore();
      put.mockRestore();
    });

    it('unfolds the group of the open page even when it was folded', () => {
      window.localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(['meeting', 'learn']));
      const view = setup({ activeId: 'review' });
      expect(header('Học').getAttribute('aria-expanded')).toBe('true');
      expect(header('Họp').getAttribute('aria-expanded')).toBe('false');
      const open = screen.getByRole('link', { name: /Ôn tập/ });
      expect(open.getAttribute('aria-current')).toBe('page');
      // Navigating into a folded group opens it too.
      view.rerender(
        <SidebarNav
          brand={null}
          activeId="meetings"
          client="web"
          renderItem={(item, { className, children }) => (
            <a href={item.webPath} className={className}>
              {children}
            </a>
          )}
        />,
      );
      expect(header('Họp').getAttribute('aria-expanded')).toBe('true');
    });

    it('still shows titles and buttons in the mobile drawer', () => {
      setup({ responsive: true, mobileOpen: true });
      expect(header('Học')).toBeTruthy();
    });
  });

  describe('admin group', () => {
    it('adds the group last with its entries in order, and nothing without extraGroups', () => {
      const without = setup();
      expect(screen.queryByRole('button', { name: 'Quản trị' })).toBeNull();
      without.unmount();
      setup({ extraGroups: [ADMIN], activeId: 'admin-users' });
      const titles = screen.getAllByRole('button').map((b) => b.textContent);
      expect(titles.at(-1)).toBe('Quản trị');
      const list = document.getElementById(header('Quản trị').getAttribute('aria-controls')!)!;
      expect(
        within(list)
          .getAllByRole('link')
          .map((a) => a.textContent?.trim()),
      ).toEqual(ADMIN.items.map((i) => i.label.trim()));
      expect(
        within(list).getByRole('link', { name: 'Người dùng & gói' }).getAttribute('aria-current'),
      ).toBe('page');
      expect(
        within(list).getByRole('link', { name: 'Tổng quan' }).getAttribute('aria-current'),
      ).toBeNull();
    });

    it('folds like the others', () => {
      setup({ extraGroups: [ADMIN], activeId: 'meetings' });
      fireEvent.click(header('Quản trị'));
      expect(screen.queryByRole('link', { name: 'Doanh thu' })).toBeNull();
    });
  });
});

describe('SidebarNav design', () => {
  it('shows the logo lockup when no brand is given, and the version under the footer', () => {
    const { container } = setup({
      brand: undefined,
      footer: <span>Tài khoản</span>,
      version: '0.1.5',
    });
    expect(container.querySelector('svg[aria-label="CueLingo"]')).toBeTruthy();
    expect(screen.getByText('Tài khoản')).toBeTruthy();
    expect(screen.getByText('Phiên bản 0.1.5')).toBeTruthy();
  });

  it('has one Ôn tập entry, and a view id from before the merge lights it up', () => {
    setup({ activeId: 'phrases' });
    expect(screen.getAllByRole('link', { name: /Ôn tập/ })).toHaveLength(1);
    expect(screen.queryByRole('link', { name: /Kho cụm từ|Tiến độ/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Ôn tập/ }).getAttribute('aria-current')).toBe('page');
  });

  it('marks what is coming with a readable "Sắp ra mắt"', () => {
    setup({ client: 'web' });
    const soon = screen.getByRole('link', { name: /Phiên họp/ });
    expect(within(soon).getByText('Sắp ra mắt')).toBeTruthy();
  });
});
