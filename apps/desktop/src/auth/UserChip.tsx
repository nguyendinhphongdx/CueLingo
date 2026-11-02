import type { Me } from '@cuelingo/shared';
import { LogOut } from 'lucide-react';
import { isDevToken } from './auth-store';
import { useMe } from './use-me';

const initialOf = (me: Me | null) =>
  (me?.name.trim() || me?.email.trim() || '?').charAt(0).toLocaleUpperCase('vi');

export function UserChipView({
  me,
  loading,
  error,
  onOpen,
  onSignOut,
}: {
  me: Me | null;
  loading: boolean;
  error: string | null;
  onOpen(): void;
  /** Omitted when nobody is signed in with an account (development token). */
  onSignOut?: () => void;
}) {
  return (
    <div className="-mx-2 flex items-center gap-1 rounded-lg px-2 py-1.5">
      <button
        type="button"
        onClick={onOpen}
        aria-label={me ? `Tài khoản: ${me.name}, ${me.email}` : 'Mở tài khoản'}
        className="focus-visible:ring-ring hover:bg-foreground/5 -ml-1 flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg p-1 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <span
          aria-hidden="true"
          className="bg-foreground text-background flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
        >
          {initialOf(me)}
        </span>
        <span className="min-w-0 flex-1">
          {me ? (
            <>
              <span className="block truncate text-sm leading-tight font-medium">{me.name}</span>
              <span className="text-muted-foreground block truncate text-xs">{me.email}</span>
            </>
          ) : (
            <span className="text-muted-foreground block truncate text-xs">
              {loading ? 'Đang tải tài khoản…' : (error ?? 'Chưa rõ tài khoản')}
            </span>
          )}
        </span>
      </button>
      {onSignOut ? (
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Đăng xuất"
          title="Đăng xuất"
          className="focus-visible:ring-ring text-muted-foreground hover:text-foreground hover:bg-foreground/10 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <LogOut aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/** Who is signed in, always visible at the bottom of the sidebar; opens the account page. */
export function UserChip({ onOpen, onSignOut }: { onOpen(): void; onSignOut(): void }) {
  const { me, loading, error } = useMe();
  return (
    <UserChipView
      me={me}
      loading={loading}
      error={error}
      onOpen={onOpen}
      onSignOut={isDevToken() ? undefined : onSignOut}
    />
  );
}
