import { SUPPORTED_LANGUAGES } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { CalendarClock } from 'lucide-react';
import { useCalendarHint } from './use-calendar-hint';

const time = (ms: number) =>
  new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

/** Offered before a meeting whose calendar entry points to another language; choosing it only sets the language. */
export function CalendarHintCard() {
  const { hint, accept, dismiss } = useCalendarHint();
  if (!hint) return null;
  const name = SUPPORTED_LANGUAGES[hint.language].name.toLowerCase();
  return (
    <section
      aria-label="Gợi ý từ lịch"
      className="bg-card flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
    >
      <CalendarClock aria-hidden="true" className="text-primary size-5 shrink-0" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-medium">{hint.title || 'Cuộc họp'}</span> lúc {time(hint.startMs)} có
        vẻ là {name}. Chọn {name} cho cuộc họp này?
      </p>
      <Button size="sm" className="cursor-pointer" onClick={accept}>
        Chọn {name}
      </Button>
      <Button size="sm" variant="ghost" className="cursor-pointer" onClick={dismiss}>
        Bỏ qua
      </Button>
    </section>
  );
}
