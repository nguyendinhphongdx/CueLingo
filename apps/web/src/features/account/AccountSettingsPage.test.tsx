import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  AccountSettingsView,
  canConfirmDeleteAccount,
  canConfirmDeleteData,
  deleteAccountAndSignOut,
  isValidAccountName,
  relativeTimeVi,
  shouldShowNamePrompt,
} from './AccountSettingsPage';

const me = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Lan',
  email: 'lan@example.com',
  createdAt: '2026-11-01T00:00:00.000Z',
};

const props = (
  overrides: Partial<ComponentProps<typeof AccountSettingsView>> = {},
): ComponentProps<typeof AccountSettingsView> => ({
  me,
  devices: [],
  loading: false,
  updating: false,
  revokingDeviceId: null,
  closing: false,
  accountError: null,
  showNamePrompt: false,
  onSaveName: async () => {},
  onSkipNamePrompt: () => {},
  onRevokeDevice: async () => {},
  onRevokeOtherSessions: async () => {},
  onCloseAccount: async () => true,
  onSignOut: () => {},
  privacy: {
    exporting: false,
    deleting: false,
    error: null,
    success: null,
    onExport: () => {},
    onDelete: () => {},
  },
  ...overrides,
});

describe('AccountSettingsView', () => {
  it('shows the full profile, browser actions, data controls and account danger zone', () => {
    const markup = renderToStaticMarkup(<AccountSettingsView {...props()} />);

    expect(markup).toContain('Lan');
    expect(markup).toContain('lan@example.com');
    expect(markup).toContain('Ngày tham gia');
    expect(markup).toContain('Đăng xuất khỏi các trình duyệt khác');
    expect(markup).toContain('Tải dữ liệu (JSON)');
    expect(markup).toContain('Đóng tài khoản');
    expect(markup).toContain('Không thể hoàn tác');
  });

  it('lists signed-in devices with recency and a revoke action', () => {
    const markup = renderToStaticMarkup(
      <AccountSettingsView
        {...props({
          devices: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              label: 'MacBook của Lan',
              createdAt: '2026-11-01T00:00:00.000Z',
              lastUsedAt: '2026-11-01T00:05:00.000Z',
            },
          ],
        })}
      />,
    );

    expect(markup).toContain('MacBook của Lan');
    expect(markup).toContain('Đăng xuất thiết bị');
    expect(markup).toContain('Dùng');
  });

  it('shows the download empty state when no desktop app is signed in', () => {
    const markup = renderToStaticMarkup(<AccountSettingsView {...props()} />);
    expect(markup).toContain('Chưa có app nào đăng nhập');
    expect(markup).toContain('href="/download"');
  });

  it('shows the first-login name step only for the default email name and not after skip', () => {
    expect(shouldShowNamePrompt('lan', 'lan@example.com', false)).toBe(true);
    expect(shouldShowNamePrompt('Lan Anh', 'lan@example.com', false)).toBe(false);
    expect(shouldShowNamePrompt('lan', 'lan@example.com', true)).toBe(false);

    const markup = renderToStaticMarkup(
      <AccountSettingsView {...props({ me: { ...me, name: 'lan' }, showNamePrompt: true })} />,
    );
    expect(markup).toContain('Bạn muốn được gọi là gì?');
    expect(markup).toContain('Bỏ qua');
  });
});

describe('account actions', () => {
  it('accepts only trimmed names from 1 to 80 characters', () => {
    expect(isValidAccountName('  Lan Anh  ')).toBe(true);
    expect(isValidAccountName('   ')).toBe(false);
    expect(isValidAccountName('a'.repeat(81))).toBe(false);
  });

  it('requires the exact destructive confirmation phrases', () => {
    expect(canConfirmDeleteData('XOA DU LIEU')).toBe(true);
    expect(canConfirmDeleteData('xoa du lieu')).toBe(false);
    expect(canConfirmDeleteAccount('XOA TAI KHOAN')).toBe(true);
    expect(canConfirmDeleteAccount('XOA TAI KHOAN ')).toBe(false);
  });

  it('deletes, signs out and redirects only after exact account confirmation', async () => {
    const remove = vi.fn(async () => {});
    const signOut = vi.fn(async () => {});
    const redirect = vi.fn();
    const actions = { remove, signOut, redirect };

    expect(await deleteAccountAndSignOut('sai', actions)).toBe(false);
    expect(remove).not.toHaveBeenCalled();

    expect(await deleteAccountAndSignOut('XOA TAI KHOAN', actions)).toBe(true);
    expect(remove).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledOnce();
    expect(remove.mock.invocationCallOrder[0]!).toBeLessThan(signOut.mock.invocationCallOrder[0]!);
    expect(signOut.mock.invocationCallOrder[0]!).toBeLessThan(
      redirect.mock.invocationCallOrder[0]!,
    );
  });

  it('formats recent device use in Vietnamese', () => {
    const now = Date.parse('2026-11-01T00:10:00.000Z');
    expect(relativeTimeVi('2026-11-01T00:05:00.000Z', now)).toContain('5 phút trước');
  });
});
