import { Button } from '@cuelingo/ui/components/button';
import { Section } from '@cuelingo/ui/components/section';
import { useState } from 'react';
import { PRIVACY_PANES, native } from '../lib/native';
import { useCalendarHint } from './use-calendar-hint';

/** Opt-in switch for language suggestions from the calendar. */
export function CalendarSettings() {
  const { enabled, toggle } = useCalendarHint();
  const [denied, setDenied] = useState(false);

  async function change(on: boolean) {
    setDenied(false);
    const result = await toggle(on);
    if (on && result !== 'granted') setDenied(true);
  }

  return (
    <Section
      title="Gợi ý từ lịch"
      description="Đọc lịch trên máy để gợi ý ngôn ngữ trước giờ họp. Nội dung lịch chỉ được xử lý trên máy này, không gửi đi đâu."
    >
      <div className="bg-card flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{enabled ? 'Đang bật' : 'Đang tắt'}</p>
          {denied ? (
            <p role="alert" className="text-destructive mt-0.5 text-sm">
              macOS chưa cho CueLingo đọc lịch. Mở Cài đặt hệ thống &gt; Quyền riêng tư &amp; Bảo
              mật &gt; Lịch để cấp quyền.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          {denied ? (
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => void native.openUrl(PRIVACY_PANES.calendar)}
            >
              Mở Cài đặt
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
