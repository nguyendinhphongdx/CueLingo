'use client';

import type { CreatedInvite, Invite } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { Card, CardContent } from '@cuelingo/ui/components/card';
import { Input } from '@cuelingo/ui/components/input';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { Section } from '@cuelingo/ui/components/section';
import { notFound } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useInvites } from './use-invites';

const date = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' });

/** `ABCDEFGHJKMN` is easier to read out loud as `ABCD-EFGH-JKMN`. */
export const formatInviteCode = (code: string): string => code.replace(/(.{4})(?=.)/g, '$1-');

function statusOf(invite: Invite, now: Date): string {
  if (invite.revokedAt) return 'Đã thu hồi';
  if (new Date(invite.expiresAt) <= now) return 'Hết hạn';
  if (invite.usedCount >= invite.maxUses) return 'Đã dùng hết';
  return 'Còn dùng được';
}

export function CreatedInviteCard({
  invite,
  onDismiss,
}: {
  invite: CreatedInvite;
  onDismiss(): void;
}) {
  const [copied, setCopied] = useState(false);
  const shown = formatInviteCode(invite.code);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shown);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Card role="status">
      <CardContent className="space-y-3 pt-5">
        <p className="text-sm">Mã mời mới. Chỉ hiện một lần, hãy sao chép trước khi đóng:</p>
        <p className="font-mono text-2xl tracking-wider select-all">{shown}</p>
        <div className="flex gap-2">
          <Button type="button" onClick={copy}>
            {copied ? 'Đã sao chép' : 'Sao chép mã'}
          </Button>
          <Button type="button" variant="outline" onClick={onDismiss}>
            Đã lưu, đóng
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function InvitesView({
  invites,
  now = new Date(),
  onRevoke,
}: {
  invites: Invite[];
  now?: Date;
  onRevoke(id: string): void;
}) {
  if (invites.length === 0) {
    return <p className="text-muted-foreground text-sm">Chưa có mã mời nào.</p>;
  }
  return (
    <Card>
      <CardContent className="overflow-x-auto px-0 py-0">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">Danh sách mã mời, không hiện nội dung mã</caption>
          <thead>
            <tr className="text-muted-foreground border-b text-left">
              <th scope="col" className="px-5 py-3 font-medium">
                Ghi chú
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                Đã dùng
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Hạn
              </th>
              <th scope="col" className="px-5 py-3 font-medium">
                Trạng thái
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invites.map((invite) => {
              const status = statusOf(invite, now);
              return (
                <tr key={invite.id} className="border-b last:border-0">
                  <td className="px-5 py-3">{invite.note ?? '—'}</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {invite.usedCount}/{invite.maxUses}
                  </td>
                  <td className="px-5 py-3">{date.format(new Date(invite.expiresAt))}</td>
                  <td className="px-5 py-3">{status}</td>
                  <td className="px-5 py-3 text-right">
                    {status === 'Còn dùng được' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onRevoke(invite.id)}
                      >
                        Thu hồi
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function InvitesPage() {
  const { invites, loading, hidden, error, create, creating, created, dismissCreated, revoke } =
    useInvites();
  const [maxUses, setMaxUses] = useState('1');
  const [days, setDays] = useState('30');
  const [note, setNote] = useState('');
  if (hidden) notFound();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    create({
      maxUses: Number(maxUses) || 1,
      expiresInDays: Number(days) || 30,
      note: note.trim() || null,
    });
    setNote('');
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Mã mời"
        description="Mỗi mã là một người thử mới. Chỉ có băm của mã được lưu, nên mã chỉ hiện một lần."
      />
      <Section title="Tạo mã">
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[6rem_6rem_1fr_auto]">
          <Input
            type="number"
            min={1}
            max={100}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            aria-label="Số lần dùng"
          />
          <Input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            aria-label="Hạn (ngày)"
          />
          <Input
            maxLength={100}
            placeholder="Ghi chú (ví dụ: nhóm kế toán)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Ghi chú"
          />
          <Button type="submit" disabled={creating}>
            {creating ? 'Đang tạo…' : 'Tạo mã'}
          </Button>
        </form>
        {created && <CreatedInviteCard invite={created} onDismiss={dismissCreated} />}
      </Section>
      <Section title="Các mã đã tạo">
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        {loading ? (
          <p className="text-muted-foreground text-sm" aria-live="polite">
            Đang tải…
          </p>
        ) : (
          <InvitesView invites={invites} onRevoke={revoke} />
        )}
      </Section>
    </main>
  );
}
