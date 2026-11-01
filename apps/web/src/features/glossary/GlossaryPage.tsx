'use client';

import { Button } from '@cuelingo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cuelingo/ui/components/card';
import { Input } from '@cuelingo/ui/components/input';
import { useState, type FormEvent } from 'react';
import { GlossaryList } from './GlossaryList';
import { useGlossary } from './use-glossary';

/** Glossary screen (US-09): terms that STT and translation should get right. */
export function GlossaryPage() {
  const { items, loading, error, adding, add, remove } = useGlossary();
  const [term, setTerm] = useState('');
  const [translation, setTranslation] = useState('');

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thuật ngữ</CardTitle>
        <CardDescription>
          Tên riêng và từ chuyên ngành giúp nhận dạng giọng nói và bản dịch chính xác hơn.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <Button type="submit" disabled={adding}>
            Thêm
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        {loading ? (
          <p className="text-muted-foreground text-sm">Đang tải…</p>
        ) : (
          <GlossaryList items={items} onRemove={remove} />
        )}
      </CardContent>
    </Card>
  );
}
