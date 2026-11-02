import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UserChipView } from './UserChip';

const me = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'phong@example.com',
  name: 'Phong Nguyen',
  createdAt: '2026-11-01T09:00:00.000Z',
};

describe('UserChipView', () => {
  it('shows the initial, name and email of who is using the app', () => {
    const markup = renderToStaticMarkup(
      <UserChipView me={me} loading={false} error={null} onOpen={() => undefined} />,
    );

    expect(markup).toContain('Phong Nguyen');
    expect(markup).toContain('phong@example.com');
    expect(markup).toContain('>P<');
    expect(markup).toContain('aria-label="Tài khoản: Phong Nguyen, phong@example.com"');
  });

  it('says it is loading, then why it could not load', () => {
    const loading = renderToStaticMarkup(
      <UserChipView me={null} loading error={null} onOpen={() => undefined} />,
    );
    expect(loading).toContain('Đang tải tài khoản');

    const failed = renderToStaticMarkup(
      <UserChipView
        me={null}
        loading={false}
        error="Phiên đăng nhập đã hết hạn."
        onOpen={() => undefined}
      />,
    );
    expect(failed).toContain('Phiên đăng nhập đã hết hạn.');
  });

  it('offers a small icon button to sign out only when an account is signed in', () => {
    const withSignOut = renderToStaticMarkup(
      <UserChipView
        me={me}
        loading={false}
        error={null}
        onOpen={() => undefined}
        onSignOut={() => undefined}
      />,
    );
    expect(withSignOut).toContain('aria-label="Đăng xuất"');
    expect(withSignOut).not.toContain('>Đăng xuất<');

    const withoutSignOut = renderToStaticMarkup(
      <UserChipView me={me} loading={false} error={null} onOpen={() => undefined} />,
    );
    expect(withoutSignOut).not.toContain('Đăng xuất');
  });
});
