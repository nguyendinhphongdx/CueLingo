import { useQuery } from '@tanstack/react-query';
import type { Session } from '@cuelingo/shared';
import { ChevronRight } from 'lucide-react';
import { openDebrief } from './session-actions';
import { sessionsApi } from './sessions-api';

const statusLabel: Record<Session['status'], string> = {
  live: 'Đang họp',
  ended: 'Đang tạo debrief',
  debriefed: 'Đã có debrief',
  deleted: 'Đã xoá',
};

const formatter = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function duration(session: Session): string | null {
  if (!session.endedAt) return null;
  const minutes = Math.max(
    1,
    Math.round((Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 60_000),
  );
  return `${minutes} phút`;
}

/** The last few meetings, each opening its debrief in the browser. Hidden until there is one. */
export function RecentSessions({
  limit = 4,
  showEmpty = false,
}: {
  limit?: number;
  showEmpty?: boolean;
}) {
  const recent = useQuery({
    queryKey: ['recent-sessions', limit],
    queryFn: () => sessionsApi.list(),
    select: (data) =>
      data.sessions.filter((session) => session.status !== 'deleted').slice(0, limit),
    staleTime: 15_000,
  });

  if (!recent.data) return null;
  if (recent.data.length === 0) {
    return showEmpty ? (
      <p className="text-muted-foreground bg-card rounded-xl border p-6 text-sm">
        Chưa có cuộc họp nào. Bấm Bắt đầu ở mục Phiên họp, debrief sẽ xuất hiện ở đây sau khi bạn
        dừng.
      </p>
    ) : null;
  }

  return (
    <section aria-labelledby="recent-title" className="space-y-3">
      <h2 id="recent-title" className="text-sm font-semibold">
        Cuộc họp gần đây
      </h2>
      <ul className="bg-card divide-y overflow-hidden rounded-xl border">
        {recent.data.map((session) => (
          <li key={session.id}>
            <button
              type="button"
              onClick={() => void openDebrief(session.id)}
              className="hover:bg-muted/60 focus-visible:ring-ring flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {session.title ?? formatter.format(new Date(session.startedAt))}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {[
                    session.title ? formatter.format(new Date(session.startedAt)) : null,
                    duration(session),
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Đang diễn ra'}
                </span>
              </span>
              <span className="text-muted-foreground text-xs">{statusLabel[session.status]}</span>
              <ChevronRight aria-hidden="true" className="text-muted-foreground size-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
