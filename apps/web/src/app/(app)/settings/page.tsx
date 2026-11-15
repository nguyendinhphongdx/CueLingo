import { AccountSettingsPage } from '../../../features/account';
import { PlacementCard } from '../../../features/placement';
import { Preferences } from '../../../features/preferences';
import { UsagePanel } from '../../../features/usage';

export default function Page() {
  return (
    <>
      <AccountSettingsPage />
      <Preferences />
      <UsagePanel />
      <PlacementCard />
    </>
  );
}
