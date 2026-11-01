import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AccountSettingsView } from './AccountSettingsPage';

describe('AccountSettingsView', () => {
  it('shows the account, sign-out action, coming-soon state and roadmap', () => {
    const markup = renderToStaticMarkup(
      <AccountSettingsView email="lan@example.com" onSignOut={() => {}} />,
    );

    expect(markup).toContain('lan@example.com');
    expect(markup).toContain('Đăng xuất');
    expect(markup).toContain('Sắp ra mắt');
    expect(markup).toContain('Đang trên lộ trình');
    expect(markup).toContain('Nhãn người nói');
  });
});
