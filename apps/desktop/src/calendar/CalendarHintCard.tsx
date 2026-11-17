import { SUPPORTED_LANGUAGES, type LanguageCode } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { CalendarClock } from 'lucide-react';
import { startsIn, type UpcomingMeeting } from './calendar-hint';
import { useCalendarHint } from './use-calendar-hint';

const time = (ms: number) =>
  new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

/** Pure card: the meeting, when it starts, and the two choices. */
export function CalendarHintView({
  hint,
  now,
  onStart,
  onDismiss,
}: {
  hint: UpcomingMeeting;
  now: number;
  onStart: (language?: LanguageCode) => void;
  onDismiss: () => void;
}) {
  const switchName = hint.switchTo ? SUPPORTED_LANGUAGES[hint.switchTo].name.toLowerCase() : null;
  return (
    <section
      aria-label="Cuộc họp sắp diễn ra"
      className="bg-secondary text-secondary-foreground flex flex-wrap items-center gap-4 rounded-lg px-4 py-3.5"
    >
      <CalendarClock aria-hidden="true" className="size-5 shrink-0" />
      <div className="min-w-0 grow">
        <p className="text-sm font-medium">
          {hint.title || 'Cuộc họp'} bắt đầu lúc {time(hint.startMs)}
        </p>
        <p className="text-sm opacity-85">
          {startsIn(hint.startMs, now)}. Từ lịch trên máy bạn.
          {switchName
            ? ` Cuộc họp này có vẻ là ${switchName}, CueLingo sẽ nghe ${switchName}.`
            : ''}
        </p>
      </div>
      <Button size="sm" variant="outline" className="cursor-pointer" onClick={onDismiss}>
        Bỏ qua
      </Button>
      <Button
        size="sm"
        className="cursor-pointer"
        onClick={() => onStart(hint.switchTo ?? undefined)}
      >
        Bắt đầu cho cuộc họp này
      </Button>
    </section>
  );
}

/** Offered from 15 minutes before a meeting in the calendar; starting uses the language the entry points to. */
export function CalendarHintCard({ onStart }: { onStart: (language?: LanguageCode) => void }) {
  const { hint, dismiss } = useCalendarHint();
  if (!hint) return null;
  return <CalendarHintView hint={hint} now={Date.now()} onStart={onStart} onDismiss={dismiss} />;
}
