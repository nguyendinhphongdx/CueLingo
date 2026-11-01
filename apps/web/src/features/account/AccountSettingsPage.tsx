'use client';

import { Button } from '@cuelingo/ui/components/button';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { Input } from '@cuelingo/ui/components/input';
import { ListCard, Section } from '@cuelingo/ui/components/section';
import { SoonBadge } from '@cuelingo/ui/components/soon-badge';
import { upcoming } from '@cuelingo/ui/lib/roadmap';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '../../lib/auth-client';
import { usePrivacy } from './use-privacy';

export const canConfirmDelete = (value: string) => value === 'XOA DU LIEU';

export function AccountSettingsView({
  email,
  onSignOut,
  privacy,
}: {
  email?: string;
  onSignOut: () => void;
  privacy: {
    exporting: boolean;
    deleting: boolean;
    error: string | null;
    success: string | null;
    onExport: () => void;
    onDelete: () => void;
  };
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const confirmationMatches = canConfirmDelete(confirmation);
  const canDelete = confirmationMatches && !privacy.deleting;

  return (
    <>
      <PageHeader title="Cài đặt" />
      <Section title="Tài khoản">
        <div className="bg-card flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Email đăng nhập</p>
            <p className="truncate text-sm font-medium">{email}</p>
          </div>
          <Button
            variant="outline"
            className="min-h-11 shrink-0 cursor-pointer"
            onClick={onSignOut}
          >
            Đăng xuất
          </Button>
        </div>
      </Section>
      <Section title="Dữ liệu của bạn">
        <div className="bg-card space-y-4 rounded-xl border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Bản sao dữ liệu</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Tải cuộc họp, transcript, debrief, cụm từ và thuật ngữ dưới dạng JSON.
              </p>
            </div>
            <Button
              variant="outline"
              className="min-h-11 shrink-0"
              disabled={privacy.exporting}
              onClick={privacy.onExport}
            >
              {privacy.exporting ? 'Đang chuẩn bị…' : 'Tải dữ liệu (JSON)'}
            </Button>
          </div>
          <div className="border-t pt-4">
            <p className="text-sm font-medium">Xoá toàn bộ dữ liệu</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Xoá vĩnh viễn dữ liệu học và cuộc họp, nhưng vẫn giữ tài khoản đăng nhập.
            </p>
            {!confirming ? (
              <Button
                variant="destructive"
                className="mt-3 min-h-11"
                onClick={() => setConfirming(true)}
              >
                Xoá toàn bộ dữ liệu
              </Button>
            ) : (
              <div className="mt-4 max-w-md space-y-3 rounded-lg border p-4">
                <label htmlFor="delete-data-confirmation" className="block text-sm font-medium">
                  Gõ XOA DU LIEU để xác nhận
                </label>
                <Input
                  id="delete-data-confirmation"
                  autoFocus
                  value={confirmation}
                  disabled={privacy.deleting}
                  aria-invalid={confirmation.length > 0 && !confirmationMatches}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="destructive" disabled={!canDelete} onClick={privacy.onDelete}>
                    {privacy.deleting ? 'Đang xoá…' : 'Xác nhận xoá'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={privacy.deleting}
                    onClick={() => {
                      setConfirming(false);
                      setConfirmation('');
                    }}
                  >
                    Huỷ
                  </Button>
                </div>
              </div>
            )}
          </div>
          {privacy.error && (
            <p role="alert" className="text-destructive text-sm">
              {privacy.error}
            </p>
          )}
          {privacy.success && (
            <p role="status" className="text-sm">
              {privacy.success}
            </p>
          )}
        </div>
      </Section>
      <Section title="Đang trên lộ trình">
        <ListCard>
          {upcoming.map((item) => (
            <li key={item.title} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-muted-foreground mt-0.5 text-sm">{item.description}</p>
              </div>
              <SoonBadge />
            </li>
          ))}
        </ListCard>
      </Section>
    </>
  );
}

export function AccountSettingsPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const privacy = usePrivacy();

  const signOut = async () => {
    await authClient.signOut();
    router.replace('/login');
  };

  return (
    <AccountSettingsView
      email={session?.user.email}
      onSignOut={() => void signOut()}
      privacy={{
        exporting: privacy.exporting,
        deleting: privacy.deleting,
        error: privacy.error,
        success: privacy.success,
        onExport: privacy.exportData,
        onDelete: privacy.deleteData,
      }}
    />
  );
}
