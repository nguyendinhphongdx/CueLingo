'use client';

import { Button } from '@cuelingo/ui/components/button';
import { Card, CardContent } from '@cuelingo/ui/components/card';
import { Input } from '@cuelingo/ui/components/input';
import { LanguageSwitcher } from '@cuelingo/ui/components/language-switcher';
import { NoticeStrip } from '@cuelingo/ui/components/notice-strip';
import { Skeleton } from '@cuelingo/ui/components/skeleton';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { Section } from '@cuelingo/ui/components/section';
import { useState, type FormEvent } from 'react';
import { parseBulkTerms } from './bulk';
import { GlossaryList } from './GlossaryList';
import { useLanguage } from '../../lib/language';
import { useGlossary } from './use-glossary';

/** Glossary screen (US-09): terms that STT and translation should get right. */
export function GlossaryPage() {
  const { language, setLanguage, options } = useLanguage();
  const { items, loading, error, adding, add, addMany, remove } = useGlossary(language);
  const [term, setTerm] = useState('');
  const [translation, setTranslation] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkDone, setBulkDone] = useState<string | null>(null);
  const bulk = parseBulkTerms(bulkText, items);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!term.trim()) return;
    try {
      await add({ term, translation: translation.trim() || null });
      setTerm('');
      setTranslation('');
    } catch {
      // The hook exposes the message as `error`; keep the inputs so the user can fix them.
    }
  };

  const onBulk = async (e: FormEvent) => {
    e.preventDefault();
    if (bulk.entries.length === 0) return;
    const added = await addMany(bulk.entries);
    setBulkDone(`Đã thêm ${added}/${bulk.entries.length} thuật ngữ.`);
    // Keep only what did not go in, so a failed paste can be retried.
    if (added === bulk.entries.length) setBulkText('');
    else
      setBulkText(
        bulk.entries
          .slice(added)
          .map((x) => (x.translation ? `${x.term} - ${x.translation}` : x.term))
          .join('\n'),
      );
  };

  return (
    <>
      <PageHeader
        title="Thuật ngữ"
        description="Giúp nhận dạng giọng nói và bản dịch chính xác hơn."
        action={<LanguageSwitcher options={options} value={language} onChange={setLanguage} />}
      />
      <Section title="Danh sách thuật ngữ">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Thuật ngữ"
                aria-label="Thuật ngữ"
              />
              <Input
                value={translation}
                onChange={(e) => setTranslation(e.target.value)}
                placeholder="Cách dịch (tuỳ chọn)"
                aria-label="Cách dịch"
              />
              <Button type="submit" className="min-h-11" disabled={adding}>
                Thêm
              </Button>
            </form>
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-expanded={bulkOpen}
                onClick={() => setBulkOpen((open) => !open)}
              >
                Dán nhiều thuật ngữ
              </Button>
              {bulkOpen && (
                <form onSubmit={onBulk} className="mt-2 space-y-2">
                  <textarea
                    value={bulkText}
                    onChange={(e) => {
                      setBulkText(e.target.value);
                      setBulkDone(null);
                    }}
                    rows={6}
                    aria-label="Danh sách thuật ngữ cần dán"
                    placeholder={
                      'Mỗi dòng một thuật ngữ, thêm cách dịch sau dấu - hoặc Tab\nSprint review - Buổi tổng kết sprint'
                    }
                    className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={adding || bulk.entries.length === 0}>
                      {`Thêm ${bulk.entries.length} thuật ngữ`}
                    </Button>
                    <p className="text-muted-foreground text-xs" aria-live="polite">
                      {bulk.skipped > 0 && `${bulk.skipped} dòng bị bỏ qua (trùng hoặc quá dài). `}
                      {bulk.overLimit > 0 && `Chỉ lấy ${bulk.entries.length} dòng đầu. `}
                      {bulkDone}
                    </p>
                  </div>
                </form>
              )}
            </div>
            {error && <NoticeStrip tone="error">{error}</NoticeStrip>}
            {loading ? (
              <div className="space-y-2" aria-busy="true">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : (
              <GlossaryList items={items} onRemove={remove} />
            )}
          </CardContent>
        </Card>
      </Section>
    </>
  );
}
