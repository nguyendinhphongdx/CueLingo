'use client';

import type { Phrase } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { Card, CardContent } from '@cuelingo/ui/components/card';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { Section } from '@cuelingo/ui/components/section';
import Link from 'next/link';
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
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">Chưa có cụm từ nào được lưu.</p>
        <Link
          href="/sessions"
          className="focus-visible:ring-ring inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent focus-visible:ring-2 focus-visible:outline-none"
        >
          Xem Cuộc họp
        </Link>
      </div>
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
          <Button
            variant="ghost"
            className="min-h-11 shrink-0"
            disabled={removingId === phrase.id}
            onClick={() => onRemove(phrase.id)}
            aria-label={`Xoá ${phrase.phrase}`}
          >
            {removingId === phrase.id ? 'Đang xoá…' : 'Xoá'}
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function PhraseBankPage() {
  const { phrases, loading, removingId, error, remove } = usePhrases();
  return (
    <>
      <PageHeader title="Cụm từ" description="Những cụm từ bạn đã lưu từ các cuộc họp." />
      <Section title="Kho cụm từ">
        <Card>
          <CardContent className="pt-6">
            {error && (
              <p role="alert" className="text-destructive mb-3 text-sm">
                {error}
              </p>
            )}
            {loading ? (
              <p className="text-muted-foreground text-sm">Đang tải cụm từ…</p>
            ) : (
              <PhraseList phrases={phrases} removingId={removingId} onRemove={remove} />
            )}
          </CardContent>
        </Card>
      </Section>
    </>
  );
}
