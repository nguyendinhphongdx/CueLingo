'use client';

import { DELETE_ACCOUNT_CONFIRMATION, type DeviceToken, type Me } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { Input } from '@cuelingo/ui/components/input';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { ListCard, Section } from '@cuelingo/ui/components/section';
import { SoonBadge } from '@cuelingo/ui/components/soon-badge';
import { upcoming } from '@cuelingo/ui/lib/roadmap';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { authClient } from '../../lib/auth-client';
import { useAccount } from './use-account';
import { usePrivacy } from './use-privacy';

const DELETE_DATA_CONFIRMATION = 'XOA DU LIEU';
const NAME_PROMPT_STORAGE_PREFIX = 'cuelingo:name-prompt-skipped:';

export const canConfirmDeleteData = (value: string) => value === DELETE_DATA_CONFIRMATION;
export const canConfirmDeleteAccount = (value: string) => value === DELETE_ACCOUNT_CONFIRMATION;
export const isValidAccountName = (value: string) => {
  const length = value.trim().length;
  return length >= 1 && length <= 80;
};
export const shouldPromptForName = (name: string, email: string) =>
  name.trim() === email.split('@')[0];
export const shouldShowNamePrompt = (name: string, email: string, skipped: boolean) =>
  shouldPromptForName(name, email) && !skipped;

export function relativeTimeVi(value: string, now = Date.now()) {
  const elapsedSeconds = Math.round((new Date(value).getTime() - now) / 1000);
  const formatter = new Intl.RelativeTimeFormat('vi', { numeric: 'always' });
  if (Math.abs(elapsedSeconds) < 60) return formatter.format(elapsedSeconds, 'second');
  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  if (Math.abs(elapsedMinutes) < 60) return formatter.format(elapsedMinutes, 'minute');
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (Math.abs(elapsedHours) < 24) return formatter.format(elapsedHours, 'hour');
  return formatter.format(Math.round(elapsedHours / 24), 'day');
}

export async function deleteAccountAndSignOut(
  confirmation: string,
  actions: { remove: () => Promise<void>; signOut: () => Promise<unknown>; redirect: () => void },
) {
  if (!canConfirmDeleteAccount(confirmation)) return false;
  await actions.remove();
  await actions.signOut();
  actions.redirect();
  return true;
}

function Avatar({ name, email, small = false }: { name: string; email: string; small?: boolean }) {
  const initial = (name.trim() || email.trim() || '?').charAt(0).toLocaleUpperCase('vi');
  return (
    <span
      aria-hidden="true"
      className={`bg-foreground text-background flex shrink-0 items-center justify-center rounded-full font-semibold ${small ? 'size-9 text-sm' : 'size-14 text-xl'}`}
    >
      {initial}
    </span>
  );
}

interface AccountSettingsViewProps {
  me: Me | null;
  devices: DeviceToken[];
  loading: boolean;
  updating: boolean;
  revokingDeviceId: string | null;
  closing: boolean;
  accountError: string | null;
  showNamePrompt: boolean;
  onSaveName: (name: string) => Promise<void>;
  onSkipNamePrompt: () => void;
  onRevokeDevice: (id: string) => Promise<void>;
  onRevokeOtherSessions: () => Promise<void>;
  onCloseAccount: (confirmation: string) => Promise<boolean>;
  onSignOut: () => void;
  privacy: {
    exporting: boolean;
    deleting: boolean;
    error: string | null;
    success: string | null;
    onExport: () => void;
    onDelete: () => void;
  };
}

export function AccountSettingsView({
  me,
  devices,
  loading,
  updating,
  revokingDeviceId,
  closing,
  accountError,
  showNamePrompt,
  onSaveName,
  onSkipNamePrompt,
  onRevokeDevice,
  onRevokeOtherSessions,
  onCloseAccount,
  onSignOut,
  privacy,
}: AccountSettingsViewProps) {
  const [name, setName] = useState(me?.name ?? '');
  const [nameSaved, setNameSaved] = useState(false);
  const [confirmingDeviceId, setConfirmingDeviceId] = useState<string | null>(null);
  const [confirmingData, setConfirmingData] = useState(false);
  const [dataConfirmation, setDataConfirmation] = useState('');
  const [confirmingAccount, setConfirmingAccount] = useState(false);
  const [accountConfirmation, setAccountConfirmation] = useState('');
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [revokingOtherSessions, setRevokingOtherSessions] = useState(false);

  useEffect(() => setName(me?.name ?? ''), [me?.name]);

  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    if (!isValidAccountName(name)) return;
    try {
      await onSaveName(name.trim());
      setName(name.trim());
      setNameSaved(true);
    } catch {
      setNameSaved(false);
    }
  };

  const revokeOtherSessions = async () => {
    setSessionError(null);
    setSessionMessage(null);
    setRevokingOtherSessions(true);
    try {
      await onRevokeOtherSessions();
      setSessionMessage('Đã đăng xuất khỏi các trình duyệt khác.');
    } catch {
      setSessionError('Không thể đăng xuất các trình duyệt khác. Vui lòng thử lại.');
    } finally {
      setRevokingOtherSessions(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Cài đặt"
        description="Quản lý hồ sơ, phiên đăng nhập và dữ liệu của bạn."
      />
      {accountError ? (
        <p role="alert" className="text-destructive mb-6 max-w-3xl text-sm">
          {accountError}
        </p>
      ) : null}

      {showNamePrompt && me ? (
        <Section title="Bạn muốn được gọi là gì?">
          <div className="bg-card max-w-2xl rounded-xl border p-4">
            <p className="text-muted-foreground text-sm">
              Tên này sẽ xuất hiện trong CueLingo và bạn có thể đổi lại bất cứ lúc nào.
            </p>
            <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={saveName}>
              <label className="flex-1 text-sm font-medium" htmlFor="welcome-name">
                Tên của bạn
                <Input
                  id="welcome-name"
                  className="mt-2"
                  value={name}
                  maxLength={81}
                  disabled={updating}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="min-h-11"
                  disabled={!isValidAccountName(name) || updating}
                >
                  {updating ? 'Đang lưu…' : 'Lưu tên'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={updating}
                  onClick={onSkipNamePrompt}
                >
                  Bỏ qua
                </Button>
              </div>
            </form>
          </div>
        </Section>
      ) : null}

      <Section title="Hồ sơ">
        <div className="bg-card max-w-3xl rounded-xl border p-4 sm:p-5">
          {loading && !me ? <p className="text-muted-foreground text-sm">Đang tải hồ sơ…</p> : null}
          {me ? (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <Avatar name={me.name} email={me.email} />
              <form className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2" onSubmit={saveName}>
                <label className="text-sm font-medium" htmlFor="account-name">
                  Tên
                  <Input
                    id="account-name"
                    className="mt-2"
                    value={name}
                    maxLength={81}
                    disabled={updating}
                    aria-describedby="account-name-help"
                    onChange={(event) => {
                      setName(event.target.value);
                      setNameSaved(false);
                    }}
                  />
                  <span id="account-name-help" className="text-muted-foreground mt-1 block text-xs">
                    Từ 1 đến 80 ký tự.
                  </span>
                </label>
                <div>
                  <p className="text-sm font-medium">Email đăng nhập</p>
                  <p className="text-muted-foreground mt-3 truncate text-sm" title={me.email}>
                    {me.email}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Ngày tham gia</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(
                      new Date(me.createdAt),
                    )}
                  </p>
                </div>
                <div className="flex items-start gap-3 sm:justify-end">
                  <Button
                    type="submit"
                    className="min-h-11"
                    disabled={!isValidAccountName(name) || updating}
                  >
                    {updating ? 'Đang lưu…' : 'Lưu'}
                  </Button>
                  {nameSaved ? (
                    <span role="status" className="self-center text-sm">
                      Đã lưu
                    </span>
                  ) : null}
                </div>
              </form>
            </div>
          ) : null}
        </div>
      </Section>

      <Section title="Thiết bị đã đăng nhập">
        <div className="bg-card max-w-3xl rounded-xl border">
          {loading && devices.length === 0 ? (
            <p className="text-muted-foreground p-4 text-sm">Đang tải thiết bị…</p>
          ) : null}
          {!loading && devices.length === 0 ? (
            <div className="p-4 sm:p-5">
              <p className="text-sm font-medium">Chưa có app nào đăng nhập</p>
              <p className="text-muted-foreground mt-1 text-sm">
                <Link href="/download" className="underline underline-offset-4">
                  Tải CueLingo cho máy tính
                </Link>{' '}
                để dùng caption trong cuộc họp.
              </p>
            </div>
          ) : null}
          {devices.map((device, index) => (
            <div key={device.id} className={`p-4 sm:p-5 ${index > 0 ? 'border-t' : ''}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {device.label || 'CueLingo cho máy tính'}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Đăng nhập{' '}
                    {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(
                      new Date(device.createdAt),
                    )}
                    {' · '}
                    {device.lastUsedAt
                      ? `Dùng ${relativeTimeVi(device.lastUsedAt)}`
                      : 'Chưa sử dụng'}
                  </p>
                </div>
                {confirmingDeviceId === device.id ? (
                  <div
                    className="flex flex-wrap items-center gap-2"
                    role="group"
                    aria-label={`Xác nhận đăng xuất ${device.label || 'thiết bị'}`}
                  >
                    <span className="text-sm">Đăng xuất thiết bị này?</span>
                    <Button
                      variant="destructive"
                      className="min-h-11"
                      disabled={revokingDeviceId === device.id}
                      onClick={() =>
                        void onRevokeDevice(device.id)
                          .then(() => setConfirmingDeviceId(null))
                          .catch(() => {})
                      }
                    >
                      {revokingDeviceId === device.id ? 'Đang đăng xuất…' : 'Xác nhận'}
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-11"
                      disabled={revokingDeviceId === device.id}
                      onClick={() => setConfirmingDeviceId(null)}
                    >
                      Huỷ
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="min-h-11 shrink-0"
                    onClick={() => setConfirmingDeviceId(device.id)}
                  >
                    Đăng xuất thiết bị
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Phiên trình duyệt">
        <div className="bg-card max-w-3xl space-y-4 rounded-xl border p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Các trình duyệt khác</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Giữ phiên này và kết thúc mọi phiên trình duyệt còn lại.
              </p>
            </div>
            <Button
              variant="outline"
              className="min-h-11 shrink-0"
              disabled={revokingOtherSessions}
              onClick={() => void revokeOtherSessions()}
            >
              {revokingOtherSessions ? 'Đang đăng xuất…' : 'Đăng xuất khỏi các trình duyệt khác'}
            </Button>
          </div>
          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">Phiên trình duyệt này</p>
            <Button variant="outline" className="min-h-11 shrink-0" onClick={onSignOut}>
              Đăng xuất
            </Button>
          </div>
          {sessionError ? (
            <p role="alert" className="text-destructive text-sm">
              {sessionError}
            </p>
          ) : null}
          {sessionMessage ? (
            <p role="status" className="text-sm">
              {sessionMessage}
            </p>
          ) : null}
        </div>
      </Section>

      <Section title="Dữ liệu của bạn">
        <div className="bg-card max-w-3xl space-y-4 rounded-xl border p-4 sm:p-5">
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
            {!confirmingData ? (
              <Button
                variant="destructive"
                className="mt-3 min-h-11"
                onClick={() => setConfirmingData(true)}
              >
                Xoá toàn bộ dữ liệu
              </Button>
            ) : (
              <div className="mt-4 max-w-md space-y-3 rounded-lg border p-4">
                <label htmlFor="delete-data-confirmation" className="block text-sm font-medium">
                  Gõ {DELETE_DATA_CONFIRMATION} để xác nhận
                </label>
                <Input
                  id="delete-data-confirmation"
                  autoFocus
                  value={dataConfirmation}
                  disabled={privacy.deleting}
                  aria-invalid={
                    dataConfirmation.length > 0 && !canConfirmDeleteData(dataConfirmation)
                  }
                  onChange={(event) => setDataConfirmation(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="destructive"
                    disabled={!canConfirmDeleteData(dataConfirmation) || privacy.deleting}
                    onClick={privacy.onDelete}
                  >
                    {privacy.deleting ? 'Đang xoá…' : 'Xác nhận xoá'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={privacy.deleting}
                    onClick={() => {
                      setConfirmingData(false);
                      setDataConfirmation('');
                    }}
                  >
                    Huỷ
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="border-destructive/30 border-t pt-4">
            <p className="text-destructive text-sm font-medium">Đóng tài khoản</p>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              Xoá vĩnh viễn tài khoản cùng mọi cuộc họp, cụm từ, thuật ngữ, debrief và thiết bị đã
              đăng nhập. Không thể hoàn tác.
            </p>
            {!confirmingAccount ? (
              <Button
                variant="destructive"
                className="mt-3 min-h-11"
                onClick={() => setConfirmingAccount(true)}
              >
                Đóng tài khoản
              </Button>
            ) : (
              <div
                className="border-destructive/30 mt-4 max-w-md space-y-3 rounded-lg border p-4"
                role="region"
                aria-label="Xác nhận đóng tài khoản"
              >
                <p className="text-sm font-medium">Bước 2 trên 2</p>
                <label htmlFor="delete-account-confirmation" className="block text-sm">
                  Gõ {DELETE_ACCOUNT_CONFIRMATION} để xác nhận
                </label>
                <Input
                  id="delete-account-confirmation"
                  autoFocus
                  value={accountConfirmation}
                  disabled={closing}
                  aria-invalid={
                    accountConfirmation.length > 0 && !canConfirmDeleteAccount(accountConfirmation)
                  }
                  onChange={(event) => setAccountConfirmation(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="destructive"
                    disabled={!canConfirmDeleteAccount(accountConfirmation) || closing}
                    onClick={() => void onCloseAccount(accountConfirmation).catch(() => {})}
                  >
                    {closing ? 'Đang đóng…' : 'Xoá tài khoản vĩnh viễn'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={closing}
                    onClick={() => {
                      setConfirmingAccount(false);
                      setAccountConfirmation('');
                    }}
                  >
                    Huỷ
                  </Button>
                </div>
              </div>
            )}
          </div>
          {privacy.error ? (
            <p role="alert" className="text-destructive text-sm">
              {privacy.error}
            </p>
          ) : null}
          {privacy.success ? (
            <p role="status" className="text-sm">
              {privacy.success}
            </p>
          ) : null}
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
  const account = useAccount();
  const privacy = usePrivacy();
  const [showNamePrompt, setShowNamePrompt] = useState(false);

  useEffect(() => {
    if (!account.me) return;
    const skipped =
      localStorage.getItem(`${NAME_PROMPT_STORAGE_PREFIX}${account.me.id}`) === 'true';
    setShowNamePrompt(shouldShowNamePrompt(account.me.name, account.me.email, skipped));
  }, [account.me]);

  const signOut = async () => {
    await authClient.signOut();
    router.replace('/login');
  };

  const revokeOtherSessions = async () => {
    const result = await authClient.revokeOtherSessions();
    if (result.error) throw result.error;
  };

  const closeAccount = (confirmation: string) =>
    deleteAccountAndSignOut(confirmation, {
      remove: account.closeAccount,
      signOut: () => authClient.signOut(),
      redirect: () => router.replace('/'),
    });

  return (
    <AccountSettingsView
      me={account.me}
      devices={account.devices}
      loading={account.loading}
      updating={account.updating}
      revokingDeviceId={account.revokingDeviceId}
      closing={account.closing}
      accountError={account.error}
      showNamePrompt={showNamePrompt}
      onSaveName={async (name) => {
        await account.updateName(name);
        setShowNamePrompt(false);
      }}
      onSkipNamePrompt={() => {
        if (account.me)
          localStorage.setItem(`${NAME_PROMPT_STORAGE_PREFIX}${account.me.id}`, 'true');
        setShowNamePrompt(false);
      }}
      onRevokeDevice={account.revokeDevice}
      onRevokeOtherSessions={revokeOtherSessions}
      onCloseAccount={closeAccount}
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
