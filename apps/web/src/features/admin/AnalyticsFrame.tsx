'use client';

import { Button } from '@cuelingo/ui/components/button';
import { PageHeader } from '@cuelingo/ui/components/page-header';
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
        <p className="text-muted-foreground text-sm" aria-live="polite">
          Đang tải số liệu…
        </p>
      ) : error ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
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
