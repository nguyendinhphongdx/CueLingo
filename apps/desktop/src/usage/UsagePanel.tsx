import { useQuery } from '@tanstack/react-query';
import { openWeb } from '../app/open-web';
import { billingApi } from './billing-api';
import { canUpgrade, UPGRADE_PATH } from './upgrade';
import { usageApi } from './usage-api';
import { UsagePanelView } from './UsagePanelView';

/** The plan and each allowance, in Settings. "Nâng gói" opens the web; a failed billing read just hides it. */
export function UsagePanel() {
  const query = useQuery({ queryKey: ['usage'], queryFn: () => usageApi.get() });
  const billing = useQuery({ queryKey: ['billing'], queryFn: () => billingApi.overview() });
  return (
    <UsagePanelView
      usage={query.data}
      loading={query.isPending}
      error={query.error ? 'Không tải được lượng dùng. Hãy thử lại sau.' : null}
      planExpiresAt={billing.data?.current.expiresAt}
      onUpgrade={canUpgrade(billing.data) ? () => void openWeb(UPGRADE_PATH) : undefined}
    />
  );
}
