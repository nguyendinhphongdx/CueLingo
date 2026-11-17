'use client';

import type { LanguageCode, Phrase } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { Card, CardContent } from '@cuelingo/ui/components/card';
import { EmptyState } from '@cuelingo/ui/components/empty-state';
import { NoticeStrip } from '@cuelingo/ui/components/notice-strip';
import { Skeleton } from '@cuelingo/ui/components/skeleton';
import { SpeakButton } from '@cuelingo/ui/components/speak-button';
import Link from 'next/link';
import { client } from '../../lib/client';
import { usePhrases } from './use-phrases';

export function PhraseList({
  phrases,
  removingId,
  onRemove,
}: {
  phrases: Phrase[];
  removingId: string | null;
  onRemove: (id: string) => void;
}) {
  if (phrases.length === 0) {
    return (
      <EmptyState
        title="Chưa có cụm từ nào được lưu"
        description="Lưu cụm từ ở debrief sau mỗi cuộc họp, chúng sẽ hiện ở đây."
        action={
          <Link
            href="/sessions"
            className="focus-visible:ring-ring hover:bg-accent inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
          >
            Xem Cuộc họp
          </Link>
        }
      />
    );
  }
  return (
    <ul className="divide-y">
      {phrases.map((phrase) => (
        <li key={phrase.id} className="flex items-center justify-between gap-4 py-3">
          <span className="min-w-0">
            <strong className="block">{phrase.phrase}</strong>
            <span className="text-muted-foreground block text-sm">
              {phrase.meaningVi || 'Chưa có nghĩa tiếng Việt'} ·{' '}
              {phrase.inReview ? 'Đang ôn' : 'Chưa ôn'}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <SpeakButton text={phrase.phrase} loadAudio={client.tts.speak} />
            <Button
              variant="ghost"
              className="min-h-11"
              disabled={removingId === phrase.id}
              onClick={() => onRemove(phrase.id)}
              aria-label={`Xoá ${phrase.phrase}`}
            >
              {removingId === phrase.id ? 'Đang xoá…' : 'Xoá'}
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The Kho cụm từ tab of Ôn tập: the phrases saved for one language. */
export function PhraseBankPanel({ language }: { language: LanguageCode }) {
  const { phrases, loading, removingId, error, remove } = usePhrases(language);
  return (
    <div className="space-y-3">
      {error && <NoticeStrip tone="error">{error}</NoticeStrip>}
      {loading ? (
        <div className="space-y-2" aria-busy="true">
          <p className="sr-only" aria-live="polite">
            Đang tải cụm từ…
          </p>
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <PhraseList phrases={phrases} removingId={removingId} onRemove={remove} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
