import { openWeb } from '../app/open-web';
import { native, type NoticeActionId, type NoticeEvent } from '../lib/native';
import { UPGRADE_PATH } from '../usage/upgrade';
import type { NoticeAction } from './NoticeBar';

const ACTIONS: Record<NoticeActionId, { label: string; run(): void }> = {
  upgrade: { label: 'Nâng cấp', run: () => void openWeb(UPGRADE_PATH).catch(() => undefined) },
  'open-settings': {
    label: 'Mở Cài đặt',
    run: () => void native.requestOpenSettings().catch(() => undefined),
  },
};

/** The button of a notice: the main window decided which fix fits (it knows the plan and the capture), the overlay only carries it out. */
export function noticeActionFor(notice: NoticeEvent): NoticeAction | undefined {
  if (!notice.action) return undefined;
  const action = ACTIONS[notice.action];
  return { label: action.label, onSelect: action.run };
}
