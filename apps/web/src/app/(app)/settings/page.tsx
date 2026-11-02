import { AccountSettingsPage } from '../../../features/account';
import { PlacementCard } from '../../../features/placement';
import { Preferences } from '../../../features/preferences';

export default function Page() {
  return (
    <>
      <AccountSettingsPage />
      <Preferences />
      <PlacementCard />
    </>
  );
}
