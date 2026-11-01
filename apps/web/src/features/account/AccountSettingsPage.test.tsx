import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AccountSettingsView, canConfirmDelete } from './AccountSettingsPage';

describe('AccountSettingsView', () => {
  it('shows the account, sign-out action, coming-soon state and roadmap', () => {
    const markup = renderToStaticMarkup(
      <AccountSettingsView
        email="lan@example.com"
        onSignOut={() => {}}
        privacy={{
          exporting: false,
          deleting: false,
          error: null,
          success: null,
          onExport: () => {},
          onDelete: () => {},
        }}
      />,
    );

    expect(markup).toContain('lan@example.com');
    expect(markup).toContain('Đăng xuất');
    expect(markup).toContain('Sắp ra mắt');
    expect(markup).toContain('Đang trên lộ trình');
    expect(markup).toContain('Nhãn người nói');
    expect(markup).toContain('Dữ liệu của bạn');
    expect(markup).toContain('Tải dữ liệu (JSON)');
    expect(markup).toContain('Xoá toàn bộ dữ liệu');
  });

  it('shows deletion progress, error and success feedback', () => {
    const markup = renderToStaticMarkup(
      <AccountSettingsView
        email="lan@example.com"
        onSignOut={() => {}}
        privacy={{
          exporting: false,
          deleting: true,
          error: 'Không kết nối được tới máy chủ',
          success: 'Đã xoá toàn bộ dữ liệu của bạn.',
          onExport: () => {},
          onDelete: () => {},
        }}
      />,
    );
    expect(markup).toContain('Không kết nối được tới máy chủ');
    expect(markup).toContain('Đã xoá toàn bộ dữ liệu của bạn.');
  });

  it('enables the destructive second step only for the exact confirmation phrase', () => {
    expect(canConfirmDelete('XOA DU LIEU')).toBe(true);
    expect(canConfirmDelete('xoa du lieu')).toBe(false);
    expect(canConfirmDelete('XOA DU LIEU ')).toBe(false);
  });
});
