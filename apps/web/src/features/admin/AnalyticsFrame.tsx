'use client';

import { Button } from '@cuelingo/ui/components/button';
import { NoticeStrip } from '@cuelingo/ui/components/notice-strip';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { Skeleton } from '@cuelingo/ui/components/skeleton';
import type { ReactNode } from 'react';
import { generatedAtText } from './analytics-format';

/**
 * The shell of an admin statistics page: title, loading and error states, and under the content the time the
 * numbers were worked out and a reload button (the API caches for a minute, so a reload may return the same).
 */
export function AnalyticsFrame({
  title,
  description,
  generatedAt,
  loading,
  error,
  onReload,
  reloading,
  children,
}: {
  title: string;
  description: string;
  generatedAt?: string;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  reloading: boolean;
  children?: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      {loading ? (
        <div className="space-y-3" aria-busy="true">
          <p className="sr-only" aria-live="polite">
            Đang tải số liệu…
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-start gap-3">
          <NoticeStrip tone="error">{error}</NoticeStrip>
          <Button variant="outline" onClick={onReload}>
            Tải lại
          </Button>
        </div>
      ) : (
        <>
          {children}
          <div className="flex flex-wrap items-center gap-3">
            {generatedAt ? (
              <p className="text-muted-foreground text-xs">{generatedAtText(generatedAt)}</p>
            ) : null}
            <Button variant="outline" onClick={onReload} disabled={reloading}>
              {reloading ? 'Đang tải…' : 'Tải lại'}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
