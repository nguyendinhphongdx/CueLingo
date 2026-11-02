import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AccountCardView } from './AccountCard';

const me = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Lan Anh',
  email: 'lan@example.com',
  createdAt: '2026-11-01T00:00:00.000Z',
};

describe('AccountCardView', () => {
  it('shows the account name, email, avatar and device sign-out action', () => {
    const markup = renderToStaticMarkup(
      <AccountCardView
        dev={false}
        signedIn
        me={me}
        loading={false}
        error={null}
        onSignOut={() => {}}
      />,
    );

    expect(markup).toContain('Lan Anh');
    expect(markup).toContain('lan@example.com');
    expect(markup).toContain('>L<');
    expect(markup).toContain('Đăng xuất khỏi thiết bị này');
  });

  it('keeps sign-out available when loading the account fails', () => {
    const markup = renderToStaticMarkup(
      <AccountCardView
        dev={false}
        signedIn
        me={null}
        loading={false}
        error="Không kết nối được tới máy chủ."
        onSignOut={() => {}}
      />,
    );

    expect(markup).toContain('Không kết nối được tới máy chủ.');
    expect(markup).toContain('Đăng xuất khỏi thiết bị này');
  });

  it('keeps the existing development-token copy', () => {
    const markup = renderToStaticMarkup(
      <AccountCardView
        dev
        signedIn={false}
        me={null}
        loading={false}
        error={null}
        onSignOut={() => {}}
      />,
    );
    expect(markup).toContain(
      'Đang chạy ở chế độ phát triển với token dev, chưa đăng nhập bằng tài khoản.',
    );
  });
});
