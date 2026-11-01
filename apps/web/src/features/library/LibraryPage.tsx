'use client';

import type { Session } from '@cuelingo/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@cuelingo/ui/components/card';
import Link from 'next/link';
import { useSessions } from './use-sessions';

const STATUS_LABELS: Record<Session['status'], string> = {
  live: 'Đang diễn ra',
  ended: 'Đang xử lý debrief…',
  debriefed: 'Đã có debrief',
  deleted: 'Đã xoá',
};

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

export function SessionList({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Chưa có cuộc họp nào. Hãy bắt đầu một phiên trong ứng dụng desktop; cuộc họp sẽ xuất hiện ở
        đây sau khi kết thúc.
      </p>
    );
  }

  const newestFirst = [...sessions].sort(
    (left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt),
  );

  return (
    <ul className="divide-y">
      {newestFirst.map((session) => (
        <li key={session.id}>
          <Link
            href={`/sessions/${session.id}`}
            className="focus-visible:ring-ring flex min-h-16 items-center justify-between gap-4 rounded-md py-3 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="min-w-0">
              <strong className="block truncate">
                {session.title?.trim() || formatDate(session.startedAt)}
              </strong>
              {session.title && (
                <span className="text-muted-foreground block text-sm">
                  {formatDate(session.startedAt)}
                </span>
              )}
            </span>
            <span className="shrink-0 text-right text-sm">
              <span className="block">{formatDuration(session)}</span>
              <span className="text-muted-foreground block">{STATUS_LABELS[session.status]}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function LibraryPage() {
  const { sessions, loading, error } = useSessions();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cuộc họp</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        {loading ? (
          <p className="text-muted-foreground text-sm">Đang tải cuộc họp…</p>
        ) : (
          <SessionList sessions={sessions} />
        )}
      </CardContent>
    </Card>
  );
}
