import { Button } from '@cuelingo/ui/components/button';
import { NoticeStrip } from '@cuelingo/ui/components/notice-strip';
import { useQuery } from '@tanstack/react-query';
import { openWeb } from '../app/open-web';
import { billingApi } from './billing-api';
import { canUpgrade, UPGRADE_PATH } from './upgrade';
import { usageApi } from './usage-api';
import { pickUsageNotice, type UsageNoticeData } from './usage-notice';

/** Pure strip: yellow with what is left, or with what still works plus Nâng cấp once it is used up. */
export function UsageNoticeView({
  notice,
  onUpgrade,
}: {
  notice: UsageNoticeData | null;
  onUpgrade?: () => void;
}) {
  if (!notice) return null;
  return (
    <NoticeStrip
      tone="warning"
      action={
        notice.exhausted && onUpgrade ? (
          <Button size="sm" className="cursor-pointer" onClick={onUpgrade}>
            Nâng cấp
          </Button>
        ) : undefined
      }
    >
      <p className="font-medium">{notice.title}</p>
      {notice.detail ? <p className="mt-0.5 font-normal">{notice.detail}</p> : null}
    </NoticeStrip>
  );
}

/** The home-page allowance notice. A failed read shows nothing: the meeting itself still decides at the server. */
export function UsageNotice() {
  const usage = useQuery({ queryKey: ['usage'], queryFn: () => usageApi.get() });
  const billing = useQuery({ queryKey: ['billing'], queryFn: () => billingApi.overview() });
  return (
    <UsageNoticeView
      notice={pickUsageNotice(usage.data?.usage)}
      onUpgrade={canUpgrade(billing.data) ? () => void openWeb(UPGRADE_PATH) : undefined}
    />
  );
}
