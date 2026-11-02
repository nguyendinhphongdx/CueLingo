import type { Me } from '@cuelingo/shared';
import { AccountChip } from '@cuelingo/ui/components/account-chip';
import { isDevToken } from './auth-store';
import { useMe } from './use-me';

/** Maps what the desktop knows about the signed-in person onto the shared account chip. */
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
    <AccountChip
      name={me?.name}
      email={me?.email}
      loading={loading}
      error={error}
      onOpen={onOpen}
      onSignOut={onSignOut}
    />
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
