import { EmptyState } from '@cuelingo/ui/components/empty-state';
import { Input } from '@cuelingo/ui/components/input';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { useDebounced } from '@cuelingo/ui/hooks/use-debounced';
import {
  isSearching,
  monthLabel,
  monthsOf,
  SEARCH_SCOPE,
  searchSessions,
  speakersOf,
} from '@cuelingo/ui/lib/meeting-search';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { SessionRows } from './RecentSessions';
import { sessionsApi } from './sessions-api';
import { useMeetingText } from './use-meeting-search';

const selectClass =
  'border-input bg-background focus-visible:ring-ring h-10 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none';

/** How long typing must pause before the meetings' text is read for the search. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Cuộc họp: the meetings, with a search over what was said plus speaker and month filters (AC10). */
export function MeetingsPage() {
  const list = useQuery({
    queryKey: ['recent-sessions', 'all'],
    queryFn: () => sessionsApi.list(),
    select: (data) => data.sessions.filter((session) => session.status !== 'deleted'),
    staleTime: 15_000,
  });
  const sessions = useMemo(() => list.data ?? [], [list.data]);
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState('');
  const [speaker, setSpeaker] = useState('');
  const searching = isSearching(query);
  const settledSearching = isSearching(useDebounced(query, SEARCH_DEBOUNCE_MS));
  // The speaker filter needs the text of the meetings, so it reads it even when no word is typed.
  const text = useMeetingText(sessions, settledSearching || speaker !== '');
  const months = useMemo(() => monthsOf(sessions), [sessions]);
  const speakers = useMemo(
    () => [...new Set([...text.details.values()].flatMap((detail) => speakersOf(detail)))],
    [text.details],
  );
  const filtered = searching || month !== '' || speaker !== '';
  const hits = useMemo(
    () => searchSessions(sessions, text.details, { query, month, speaker }),
    [sessions, text.details, query, month, speaker],
  );
  const clear = () => {
    setQuery('');
    setMonth('');
    setSpeaker('');
  };

  return (
    <>
      <PageHeader
        title="Cuộc họp"
        description="Tìm lại điều ai đó đã nói. Bấm vào một cuộc họp để mở debrief trên web."
      />
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          maxLength={100}
          className="max-w-sm"
          placeholder="Tìm trong tiêu đề và lời thoại"
          aria-label="Tìm trong cuộc họp"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Lọc theo tháng"
          className={selectClass}
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        >
          <option value="">Mọi tháng</option>
          {months.map((key) => (
            <option key={key} value={key}>
              {monthLabel(key)}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc theo người nói"
          className={selectClass}
          value={speaker}
          onChange={(event) => setSpeaker(event.target.value)}
        >
          <option value="">Mọi người nói</option>
          {speakers.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {searching && text.skipped > 0 && (
        <p className="text-muted-foreground text-xs">
          Tìm lời thoại trong {SEARCH_SCOPE} cuộc họp gần nhất; cuộc họp cũ hơn chỉ khớp theo tiêu
          đề.
        </p>
      )}
      {list.isError && (
        <p role="alert" className="text-destructive text-sm">
          Không tải được danh sách cuộc họp. Hãy thử lại sau.
        </p>
      )}
      {text.reading && (
        <p className="text-muted-foreground text-sm" aria-live="polite">
          Đang đọc lời thoại để tìm…
        </p>
      )}
      {list.isPending ? (
        <p className="text-muted-foreground text-sm" aria-live="polite">
          Đang tải cuộc họp…
        </p>
      ) : filtered ? (
        hits.length > 0 ? (
          <>
            <SessionRows hits={hits} query={query} />
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground" aria-live="polite">
                {hits.length} cuộc họp khớp
              </p>
              <button
                type="button"
                onClick={clear}
                className="text-primary focus-visible:ring-ring cursor-pointer rounded-md px-2 py-1 focus-visible:ring-2 focus-visible:outline-none"
              >
                Xoá bộ lọc
              </button>
            </div>
          </>
        ) : (
          <EmptyState
            title="Không có cuộc họp nào khớp"
            description="Thử từ khoá khác hoặc bỏ bớt bộ lọc."
            action={
              <button
                type="button"
                onClick={clear}
                className="text-primary focus-visible:ring-ring cursor-pointer rounded-md px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                Xoá bộ lọc
              </button>
            }
          />
        )
      ) : sessions.length === 0 ? (
        <EmptyState
          title="Chưa có cuộc họp nào"
          description="Bấm Bắt đầu ở mục Phiên họp; debrief sẽ xuất hiện ở đây sau khi bạn dừng."
        />
      ) : (
        <SessionRows hits={hits} />
      )}
    </>
  );
}
