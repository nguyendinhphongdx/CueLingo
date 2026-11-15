import { useQuery } from '@tanstack/react-query';
import { usageApi } from './usage-api';
import { UsagePanelView } from './UsagePanelView';

/** The plan and each allowance, in Settings. */
export function UsagePanel() {
  const query = useQuery({ queryKey: ['usage'], queryFn: () => usageApi.get() });
  return (
    <UsagePanelView
      usage={query.data}
      loading={query.isPending}
      error={query.error ? 'Không tải được lượng dùng. Hãy thử lại sau.' : null}
    />
  );
}
