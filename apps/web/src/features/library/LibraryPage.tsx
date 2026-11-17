'use client';

import type { Session } from '@cuelingo/shared';
import { Card, CardContent } from '@cuelingo/ui/components/card';
import { EmptyState } from '@cuelingo/ui/components/empty-state';
import { Input } from '@cuelingo/ui/components/input';
import { NoticeStrip } from '@cuelingo/ui/components/notice-strip';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { Skeleton } from '@cuelingo/ui/components/skeleton';
import { sessionListLabel } from '@cuelingo/ui/lib/session-state';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import {
  highlight,
  isSearching,
  monthLabel,
  monthsOf,
  SEARCH_SCOPE,
  searchSessions,
  speakersOf,
  type SessionHit,
  type Snippet,
} from './search';
import { useDebounced } from '../../lib/use-debounced';
import { useSessions, useSessionText } from './use-sessions';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDuration(session: Session) {
  if (!session.endedAt) return 'Đang diễn ra';
  const totalSeconds = Math.max(
    0,
    Math.round((Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 1000),
  );
  if (totalSeconds < 60) return `${totalSeconds} giây`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
}

/** `text` with the parts equal to `query` marked. */
export function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlight(text, query).map((part, index) =>
        part.match ? (
          <mark key={index} className="bg-warning/20 text-foreground rounded-sm px-0.5">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

function SnippetLine({ snippet, query }: { snippet: Snippet; query: string }) {
  return (
    <p className="text-muted-foreground text-sm">
      <span className="text-foreground font-medium">{snippet.speaker}: </span>
      <Highlighted text={snippet.text} query={query} />
    </p>
  );
}

export function SessionList({
  sessions,
  hits,
  query = '',
  empty,
}: {
  sessions?: Session[];
  /** Search results: a meeting with the lines that matched. Used instead of `sessions`. */
  hits?: SessionHit[];
  query?: string;
  /** What to show when nothing is listed; defaults to the "no meetings yet" guidance. */
  empty?: ReactNode;
}) {
  const rows: SessionHit[] = hits ?? (sessions ?? []).map((session) => ({ session, snippets: [] }));
  if (rows.length === 0) {
    return (
      empty ?? (
        <EmptyState
          title="Chưa có cuộc họp nào"
          description="Hãy bắt đầu một phiên trong ứng dụng desktop; cuộc họp sẽ xuất hiện ở đây sau khi kết thúc."
        />
      )
    );
  }

  const newestFirst = [...rows].sort(
    (left, right) => Date.parse(right.session.startedAt) - Date.parse(left.session.startedAt),
  );

  return (
    <ul className="divide-y">
      {newestFirst.map(({ session, snippets }) => (
        <li key={session.id}>
          <Link
            href={`/sessions/${session.id}`}
            className="focus-visible:ring-ring hover:bg-accent flex min-h-16 items-center justify-between gap-4 rounded-md px-2 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="min-w-0">
              <strong className="block truncate">
                {session.title?.trim() ? (
                  <Highlighted text={session.title.trim()} query={query} />
                ) : (
                  formatDate(session.startedAt)
                )}
              </strong>
              {session.title && (
                <span className="text-muted-foreground block text-sm">
                  {formatDate(session.startedAt)}
                </span>
              )}
              {snippets.map((snippet) => (
                <SnippetLine key={snippet.segmentId} snippet={snippet} query={query} />
              ))}
            </span>
            <span className="shrink-0 text-right text-sm">
              <span className="block">{formatDuration(session)}</span>
              <span className="text-muted-foreground block">{sessionListLabel(session)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const selectClass =
  'border-input bg-background focus-visible:ring-ring h-10 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none';

/** How long typing must pause before the meetings' text is fetched for the search. */
export const SEARCH_DEBOUNCE_MS = 300;

export function LibraryPage() {
  const { sessions, loading, error } = useSessions();
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState('');
  const [speaker, setSpeaker] = useState('');
  const searching = isSearching(query);
  // Fetching the text of up to SEARCH_SCOPE meetings waits until typing pauses.
  const settledSearching = isSearching(useDebounced(query, SEARCH_DEBOUNCE_MS));
  // The speaker filter needs the text of the meetings, so it reads it even when no word is typed.
  const text = useSessionText(sessions, settledSearching || speaker !== '');
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

  return (
    <>
      <PageHeader title="Cuộc họp" description="Xem lại các cuộc họp và mở debrief sau họp." />
      <div className="mt-6 space-y-4">
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
        {error && <NoticeStrip tone="error">{error}</NoticeStrip>}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-3" aria-busy="true">
                <p className="sr-only" aria-live="polite">
                  Đang tải cuộc họp…
                </p>
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : (
              <>
                {text.reading && (
                  <p className="text-muted-foreground mb-3 text-sm" aria-live="polite">
                    Đang đọc lời thoại để tìm…
                  </p>
                )}
                {filtered ? (
                  <SessionList
                    hits={hits}
                    query={query}
                    empty={
                      <EmptyState
                        title="Không có cuộc họp nào khớp"
                        description="Thử từ khoá khác hoặc bỏ bớt bộ lọc."
                      />
                    }
                  />
                ) : (
                  <SessionList sessions={sessions} />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
