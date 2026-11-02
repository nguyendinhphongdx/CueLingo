import type { Me } from '@cuelingo/shared';
import { IconButton } from '@cuelingo/ui/components/icon-button';
import { PersonRow } from '@cuelingo/ui/components/person-row';
import { LogOut } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cuelingo/ui/components/card';
import { isDevToken, useAuthStore } from './auth-store';
import { useMe } from './use-me';

function SignOutButton({ onSignOut }: { onSignOut(): void }) {
  return (
    <IconButton
      label="Đăng xuất khỏi thiết bị này"
      icon={<LogOut aria-hidden="true" className="size-[18px]" />}
      onClick={onSignOut}
    />
  );
}

export function AccountCardView({
  dev,
  signedIn,
  me,
  loading,
  error,
  onSignOut,
}: {
  dev: boolean;
  signedIn: boolean;
  me: Me | null;
  loading: boolean;
  error: string | null;
  onSignOut(): void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tài khoản</CardTitle>
        <CardDescription>
          {dev
            ? 'Đang chạy ở chế độ phát triển với token dev, chưa đăng nhập bằng tài khoản.'
            : 'Thiết bị này đã đăng nhập. Cuộc họp và cụm từ được đồng bộ với web.'}
        </CardDescription>
      </CardHeader>
      {signedIn || me ? (
        <CardContent className="space-y-3">
          {loading ? <p className="text-muted-foreground text-sm">Đang tải tài khoản…</p> : null}
          {me ? (
            <PersonRow
              name={me.name}
              email={me.email}
              actions={signedIn ? <SignOutButton onSignOut={onSignOut} /> : null}
            />
          ) : signedIn ? (
            <SignOutButton onSignOut={onSignOut} />
          ) : null}
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

/** Settings card: who is signed in on this device, and how to sign out. */
export function AccountCard({ onSignOut }: { onSignOut(): void }) {
  const token = useAuthStore((state) => state.token);
  const dev = isDevToken();
  const { me, loading, error } = useMe();

  return (
    <AccountCardView
      dev={dev}
      signedIn={Boolean(token)}
      me={me}
      loading={loading}
      error={error}
      onSignOut={onSignOut}
    />
  );
}
