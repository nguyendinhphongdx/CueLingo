import { SUPPORTED_LANGUAGES, type LanguageCode, type PrepCourse } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { CalendarClock } from 'lucide-react';
import { startsIn, type UpcomingMeeting } from './calendar-hint';
import { useCalendarHint } from './use-calendar-hint';
import { useMeetingPrep } from './use-meeting-prep';

const time = (ms: number) =>
  new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

export interface PrepState {
  /** Called when the person asks to prepare; the button shows only when earlier meetings match. */
  onPrepare: () => void;
  preparing: boolean;
  failed: boolean;
  result: PrepCourse | null;
}

/** Phrases from the matching meetings and the glossary terms, shown once and not saved anywhere. */
function PrepList({ result }: { result: PrepCourse }) {
  if (result.lessons.length === 0 && result.terms.length === 0) {
    return <p className="text-sm opacity-85">Chưa có cụm từ nào đã lưu từ các cuộc họp trước.</p>;
  }
  return (
    <div className="basis-full text-sm">
      {result.lessons.length > 0 ? (
        <ul className="list-disc pl-5">
          {result.lessons.slice(0, 5).map((lesson) => (
            <li key={lesson.phrase}>
              <span className="font-medium">{lesson.phrase}</span>
              {lesson.meaningVi ? ` · ${lesson.meaningVi}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
      {result.terms.length > 0 ? (
        <p className="mt-1 opacity-85">
          Thuật ngữ: {result.terms.map((entry) => entry.term).join(', ')}
        </p>
      ) : null}
    </div>
  );
}

/** Pure card: the meeting, when it starts, and the choices (plus preparing, when earlier meetings match). */
export function CalendarHintView({
  hint,
  now,
  onStart,
  onDismiss,
  prep,
}: {
  hint: UpcomingMeeting;
  now: number;
  onStart: (language?: LanguageCode) => void;
  onDismiss: () => void;
  prep?: PrepState;
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
      {prep ? (
        <Button
          size="sm"
          variant="outline"
          className="cursor-pointer"
          disabled={prep.preparing}
          onClick={prep.onPrepare}
        >
          Chuẩn bị
        </Button>
      ) : null}
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
      {prep?.result ? <PrepList result={prep.result} /> : null}
      {prep?.failed ? (
        <p role="alert" className="basis-full text-sm">
          Không tải được phần chuẩn bị. Bạn vẫn bắt đầu cuộc họp được.
        </p>
      ) : null}
    </section>
  );
}

/** Offered from 15 minutes before a meeting in the calendar; starting uses the language the entry points to. */
export function CalendarHintCard({ onStart }: { onStart: (language?: LanguageCode) => void }) {
  const { hint, dismiss, language } = useCalendarHint();
  if (!hint) return null;
  return (
    <CalendarHintWithPrep
      hint={hint}
      language={hint.switchTo ?? language}
      onStart={onStart}
      onDismiss={dismiss}
    />
  );
}

/** Only mounted while a hint shows, so the earlier meetings are never fetched with calendar hints off. */
function CalendarHintWithPrep({
  hint,
  language,
  onStart,
  onDismiss,
}: {
  hint: UpcomingMeeting;
  language: LanguageCode;
  onStart: (language?: LanguageCode) => void;
  onDismiss: () => void;
}) {
  const meetingPrep = useMeetingPrep(hint, language);
  return (
    <CalendarHintView
      hint={hint}
      now={Date.now()}
      onStart={onStart}
      onDismiss={onDismiss}
      prep={
        meetingPrep.available
          ? {
              onPrepare: meetingPrep.prepare,
              preparing: meetingPrep.preparing,
              failed: meetingPrep.failed,
              result: meetingPrep.result,
            }
          : undefined
      }
    />
  );
}
