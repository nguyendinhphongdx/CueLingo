import { LogOut } from 'lucide-react';
import { Avatar } from './avatar';
import { IconButton } from './icon-button';

/**
 * Who is signed in, at the foot of the sidebar: round avatar, name and email, a small sign-out icon.
 * Desktop and web both use this; neither draws its own.
 */
export function AccountChip({
  name,
  email,
  loading = false,
  error,
  onOpen,
  onSignOut,
}: {
  name?: string | null;
  email?: string | null;
  loading?: boolean;
  error?: string | null;
  onOpen(): void;
  /** Omitted when nobody is signed in with an account (development token). */
  onSignOut?: () => void;
}) {
  const known = Boolean(name || email);
  return (
    <div className="-mx-2 flex items-center gap-1 rounded-lg px-2 py-1.5">
      <button
        type="button"
        onClick={onOpen}
        aria-label={known ? `Tài khoản: ${name}, ${email}` : 'Mở tài khoản'}
        className="focus-visible:ring-ring hover:bg-foreground/5 -ml-1 flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg p-1 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <Avatar name={name} email={email} size="md" />
        <span className="min-w-0 flex-1">
          {known ? (
            <>
              <span className="block truncate text-sm leading-tight font-medium">
                {name || email}
              </span>
              {name && email ? (
                <span className="text-muted-foreground block truncate text-xs">{email}</span>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground block truncate text-xs">
              {loading ? 'Đang tải tài khoản…' : (error ?? 'Chưa rõ tài khoản')}
            </span>
          )}
        </span>
      </button>
      {onSignOut ? (
        <IconButton
          label="Đăng xuất"
          icon={<LogOut aria-hidden="true" className="size-4" />}
          onClick={onSignOut}
        />
      ) : null}
    </div>
  );
}
