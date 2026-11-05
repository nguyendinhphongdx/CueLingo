'use client';

import { Button } from '@cuelingo/ui/components/button';
import { Input } from '@cuelingo/ui/components/input';
import { useState, type FormEvent } from 'react';

/** Inline form to change a conversation's title (1 to 120 characters). */
export function RenameForm({
  title,
  saving,
  onSave,
  onCancel,
}: {
  title: string;
  saving: boolean;
  onSave: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(title);
  const next = value.trim();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (next && next !== title) onSave(next);
    else onCancel();
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <Input
        autoFocus
        value={value}
        maxLength={120}
        aria-label="Tên cuộc trò chuyện"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel();
        }}
        className="min-h-11 min-w-0 flex-1"
      />
      <Button type="submit" className="min-h-11" disabled={saving || !next}>
        Lưu
      </Button>
      <Button type="button" variant="ghost" className="min-h-11" onClick={onCancel}>
        Huỷ
      </Button>
    </form>
  );
}
