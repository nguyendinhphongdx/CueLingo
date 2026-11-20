import { Button } from '@cuelingo/ui/components/button';
import { Section } from '@cuelingo/ui/components/section';
import { useState } from 'react';
import { PRIVACY_PANES, native } from '../lib/native';
import { ensureNotificationPermission } from './native-gate';
import { readNotificationsEnabled, writeNotificationsEnabled } from './notifications';

/** The switch for system notifications: on by default; turning it on asks the system once. */
export function NotificationSettings() {
  const [enabled, setEnabled] = useState(readNotificationsEnabled);
  const [blocked, setBlocked] = useState(false);

  async function change(on: boolean) {
    setBlocked(false);
    writeNotificationsEnabled(on);
    setEnabled(on);
    if (on && !(await ensureNotificationPermission())) setBlocked(true);
  }

  return (
    <Section
      title="Thông báo hệ thống"
      description="Báo khi debrief tạo xong hoặc micro/âm thanh hệ thống bị lỗi lúc CueLingo đang chạy nền. Thông báo chỉ có chữ cố định, không chứa nội dung cuộc họp."
    >
      <div className="bg-card flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{enabled ? 'Đang bật' : 'Đang tắt'}</p>
          {blocked ? (
            <p role="alert" className="text-destructive mt-0.5 text-sm">
              Hệ điều hành chưa cho CueLingo gửi thông báo. Mở cài đặt thông báo của hệ thống để cho
              phép.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          {blocked ? (
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => void native.openUrl(PRIVACY_PANES.notifications)}
            >
              Mở cài đặt
            </Button>
          ) : null}
          <Button
            variant={enabled ? 'outline' : 'default'}
            className="cursor-pointer"
            onClick={() => void change(!enabled)}
          >
            {enabled ? 'Tắt' : 'Bật'}
          </Button>
        </div>
      </div>
    </Section>
  );
}
