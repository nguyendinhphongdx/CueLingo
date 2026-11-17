import { ThemeSwitch } from '@cuelingo/ui/components/theme-switch';
import { AccountSettingsPage } from '../../../features/account';
import { PlacementCard } from '../../../features/placement';
import { Preferences } from '../../../features/preferences';
import { UsagePanel } from '../../../features/usage';

export default function Page() {
  return (
    <>
      <AccountSettingsPage />
      <ThemeSwitch />
      <Preferences />
      <UsagePanel />
      <PlacementCard />
    </>
  );
}
