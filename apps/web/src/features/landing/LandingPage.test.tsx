import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('../../lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false }),
  },
}));

import { LandingPage } from './LandingPage';
import { redirectSignedInVisitor } from './session-redirect';

describe('LandingPage', () => {
  it('shows the public promise, macOS action, sign-in link, and real caption copy', () => {
    const markup = renderToStaticMarkup(<LandingPage />);

    expect(markup).toContain('<h1');
    expect(markup).toContain(
      'Caption song ngữ hiện ngay trên cuộc họp tiếng Anh, Nhật, Hàn, Trung',
    );
    expect(markup).toContain('href="/download"');
    expect(markup).toContain('Tải cho macOS');
    expect(markup).toContain('href="/login"');
    expect(markup).toContain('Đăng nhập');
    expect(markup).toContain('Let&#x27;s align on the launch plan before Friday.');
  });

  it('replaces the route with /sessions for a signed-in visitor', () => {
    const replace = vi.fn();

    redirectSignedInVisitor({ user: { id: 'user-1' } }, false, { replace });

    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith('/sessions');
  });

  it('does not redirect while the session is pending or absent', () => {
    const replace = vi.fn();

    redirectSignedInVisitor(null, true, { replace });
    redirectSignedInVisitor(null, false, { replace });

    expect(replace).not.toHaveBeenCalled();
  });
});
