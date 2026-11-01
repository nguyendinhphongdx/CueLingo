import { Button } from '@cuelingo/ui/components/button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@cuelingo/shared';
import { ChevronRight, Trash2 } from 'lucide-react';
import { useState } from 'react';
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
  const queryClient = useQueryClient();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const recent = useQuery({
    queryKey: ['recent-sessions', limit],
    queryFn: () => sessionsApi.list(),
    select: (data) =>
      data.sessions.filter((session) => session.status !== 'deleted').slice(0, limit),
    staleTime: 15_000,
  });
  const remove = useMutation({
    mutationFn: (sessionId: string) => sessionsApi.remove(sessionId),
    onSuccess: async () => {
      setConfirmingId(null);
      await queryClient.invalidateQueries({ queryKey: ['recent-sessions'] });
    },
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
          <li key={session.id} className="px-2 py-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void openDebrief(session.id)}
                className="hover:bg-muted/60 focus-visible:ring-ring flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md px-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
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
              <Button
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11"
                aria-label={`Xoá cuộc họp ${session.title ?? formatter.format(new Date(session.startedAt))}`}
                disabled={remove.isPending}
                onClick={() => setConfirmingId(session.id)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            {confirmingId === session.id && (
              <div
                className="flex flex-wrap items-center justify-end gap-2 px-2 pb-2"
                role="group"
                aria-label="Xác nhận xoá cuộc họp"
              >
                <span className="text-sm">Xoá cuộc họp này?</span>
                <Button
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(session.id)}
                >
                  {remove.isPending ? 'Đang xoá…' : 'Xác nhận'}
                </Button>
                <Button
                  variant="outline"
                  disabled={remove.isPending}
                  onClick={() => setConfirmingId(null)}
                >
                  Huỷ
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {remove.error && (
        <p role="alert" className="text-destructive text-sm">
          Không thể xoá cuộc họp. Vui lòng thử lại.
        </p>
      )}
    </section>
  );
}
