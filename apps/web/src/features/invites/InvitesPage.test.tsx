import type { Invite } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CreatedInviteCard, InvitesView, formatInviteCode } from './InvitesPage';

vi.mock('next/navigation', () => ({ notFound: vi.fn() }));

const now = new Date('2026-11-10T00:00:00Z');
const base: Invite = {
  id: '3c1c8f6e-8d0a-4f27-9d8e-2b6f7a8f9c10',
  note: 'nhóm kế toán',
  maxUses: 3,
  usedCount: 1,
  expiresAt: '2026-12-01T00:00:00.000Z',
  revokedAt: null,
  createdAt: '2026-11-01T00:00:00.000Z',
};

describe('invites page', () => {
  it('groups a code in fours so it can be read aloud', () => {
    expect(formatInviteCode('ABCDEFGHJKMN')).toBe('ABCD-EFGH-JKMN');
  });

  it('shows the plain code only in the one-time card', () => {
    const markup = renderToStaticMarkup(
      <CreatedInviteCard invite={{ ...base, code: 'ABCDEFGHJKMN' }} onDismiss={() => {}} />,
    );
    expect(markup).toContain('ABCD-EFGH-JKMN');
    expect(markup).toContain('Chỉ hiện một lần');
  });

  it('lists invites without any code and offers revoke only for usable ones', () => {
    const markup = renderToStaticMarkup(
      <InvitesView
        now={now}
        onRevoke={() => {}}
        invites={[
          base,
          { ...base, id: '4c1c8f6e-8d0a-4f27-9d8e-2b6f7a8f9c10', usedCount: 3 },
          {
            ...base,
            id: '5c1c8f6e-8d0a-4f27-9d8e-2b6f7a8f9c10',
            revokedAt: '2026-11-02T00:00:00.000Z',
          },
          {
            ...base,
            id: '6c1c8f6e-8d0a-4f27-9d8e-2b6f7a8f9c10',
            expiresAt: '2026-11-05T00:00:00.000Z',
          },
        ]}
      />,
    );
    expect(markup).toContain('Còn dùng được');
    expect(markup).toContain('Đã dùng hết');
    expect(markup).toContain('Đã thu hồi');
    expect(markup).toContain('Hết hạn');
    expect(markup.match(/Thu hồi<\/button>/g) ?? []).toHaveLength(1);
    expect(markup).not.toMatch(/ABCD|code/i);
  });

  it('says so when there are no invites yet', () => {
    expect(renderToStaticMarkup(<InvitesView invites={[]} onRevoke={() => {}} />)).toContain(
      'Chưa có mã mời nào',
    );
  });
});
