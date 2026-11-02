import type { Me } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cuelingo/ui/components/card';
import { useEffect, useState } from 'react';
import { isDevToken, useAuthStore } from './auth-store';
import { describeMeError, meApi } from './me-api';

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
      {signedIn ? (
        <CardContent className="space-y-4">
          {loading ? <p className="text-muted-foreground text-sm">Đang tải tài khoản…</p> : null}
          {me ? (
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="bg-foreground text-background flex size-11 shrink-0 items-center justify-center rounded-full font-semibold"
              >
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{me.name}</p>
                <p className="text-muted-foreground truncate text-sm">{me.email}</p>
              </div>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <Button variant="outline" className="min-h-11 cursor-pointer" onClick={onSignOut}>
            Đăng xuất khỏi thiết bị này
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
}

/** Settings card: who is signed in on this device, and how to sign out. */
export function AccountCard({ onSignOut }: { onSignOut(): void }) {
  const token = useAuthStore((state) => state.token);
  const dev = isDevToken();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || dev) return;
    let active = true;
    setLoading(true);
    setError(null);
    void meApi
      .get()
      .then((value) => {
        if (active) setMe(value);
      })
      .catch((cause: unknown) => {
        if (active) setError(describeMeError(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dev, token]);

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
