import type { Me } from '@cuelingo/shared';
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
  const initial = (me?.name.trim() || me?.email.trim() || '?').charAt(0).toLocaleUpperCase('vi');

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
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="bg-foreground text-background flex size-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold"
              >
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{me.name}</p>
                <p className="text-muted-foreground truncate text-sm">{me.email}</p>
              </div>
              {signedIn ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  aria-label="Đăng xuất khỏi thiết bị này"
                  title="Đăng xuất khỏi thiết bị này"
                  className="focus-visible:ring-ring text-muted-foreground hover:text-foreground hover:bg-foreground/10 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <LogOut aria-hidden="true" className="size-[18px]" />
                </button>
              ) : null}
            </div>
          ) : signedIn ? (
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Đăng xuất khỏi thiết bị này"
              title="Đăng xuất khỏi thiết bị này"
              className="focus-visible:ring-ring text-muted-foreground hover:text-foreground hover:bg-foreground/10 flex size-9 cursor-pointer items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <LogOut aria-hidden="true" className="size-[18px]" />
            </button>
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
