import type { CreateGlossaryTermInput, GlossaryTerm, UpdateGlossaryTerm } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { Card, CardContent } from '@cuelingo/ui/components/card';
import { Input } from '@cuelingo/ui/components/input';
import { Section } from '@cuelingo/ui/components/section';
import { Search } from 'lucide-react';
import { useDeferredValue, useState, type FormEvent } from 'react';
import { useGlossary } from './use-glossary';
import { useLanguage } from '../settings';

const fieldClass =
  'min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50';

interface GlossaryViewProps {
  items: GlossaryTerm[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  onAdd: (input: CreateGlossaryTermInput) => Promise<boolean>;
  onUpdate: (id: string, patch: UpdateGlossaryTerm) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
  onRetry: () => Promise<void>;
  initialEditingId?: string | null;
  initialDeletingId?: string | null;
}

export function GlossaryView({
  items,
  loading,
  saving,
  error,
  onAdd,
  onUpdate,
  onRemove,
  onRetry,
  initialEditingId = null,
  initialDeletingId = null,
}: GlossaryViewProps) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase('vi'));
  const [editingId, setEditingId] = useState<string | null>(initialEditingId);
  const [deletingId, setDeletingId] = useState<string | null>(initialDeletingId);
  const [term, setTerm] = useState('');
  const [translation, setTranslation] = useState('');
  const [note, setNote] = useState('');

  const filtered = items.filter((item) =>
    [item.term, item.translation, item.note].some((value) =>
      value?.toLocaleLowerCase('vi').includes(deferredQuery),
    ),
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!term.trim()) return;
    const saved = await onAdd({
      term,
      translation: translation.trim() || null,
      note: note.trim() || null,
    });
    if (saved) {
      setTerm('');
      setTranslation('');
      setNote('');
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground max-w-2xl text-sm leading-6">
        Caption sẽ nghe và dịch đúng các từ này. Thêm tên riêng, sản phẩm hoặc thuật ngữ thường dùng
        trong cuộc họp.
      </p>

      <Section title="Thêm thuật ngữ">
        <Card className="gap-0 rounded-lg py-5 shadow-none">
          <CardContent>
            <form className="grid gap-4 lg:grid-cols-2" onSubmit={submit}>
              <Field label="Thuật ngữ" htmlFor="new-term">
                <Input
                  id="new-term"
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  placeholder="Ví dụ: product discovery"
                  maxLength={120}
                  required
                />
              </Field>
              <Field label="Nghĩa tiếng Việt" htmlFor="new-translation">
                <Input
                  id="new-translation"
                  value={translation}
                  onChange={(event) => setTranslation(event.target.value)}
                  placeholder="Ví dụ: khám phá sản phẩm"
                  maxLength={200}
                />
              </Field>
              <div className="lg:col-span-2">
                <Field label="Ghi chú" htmlFor="new-note">
                  <textarea
                    id="new-note"
                    className={fieldClass}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Ngữ cảnh hoặc cách dùng (tuỳ chọn)"
                    maxLength={500}
                    rows={2}
                  />
                </Field>
              </div>
              <div className="lg:col-span-2">
                <Button
                  type="submit"
                  className="bg-foreground text-background hover:bg-foreground/90"
                  disabled={saving || !term.trim()}
                >
                  {saving ? 'Đang lưu…' : 'Thêm thuật ngữ'}
                </Button>
              </div>
            </form>
            {error ? (
              <p role="alert" className="text-destructive mt-4 text-sm">
                {error}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </Section>

      <Section title="Danh sách thuật ngữ">
        <div className="relative max-w-md">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            type="search"
            aria-label="Tìm thuật ngữ"
            className="pl-9"
            placeholder="Tìm thuật ngữ, nghĩa hoặc ghi chú"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Đang tải thuật ngữ…</p>
        ) : error && items.length === 0 ? (
          <div className="rounded-lg border p-5">
            <p role="alert" className="text-sm">
              {error}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void onRetry()}>
              Thử lại
            </Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyGlossary />
        ) : filtered.length === 0 ? (
          <p className="rounded-lg border p-5 text-sm">
            Không tìm thấy thuật ngữ phù hợp. Thử một từ khoá khác.
          </p>
        ) : (
          <ul className="bg-card divide-y overflow-hidden rounded-lg border">
            {filtered.map((item) => (
              <GlossaryRow
                key={item.id}
                item={item}
                saving={saving}
                editing={editingId === item.id}
                confirmingDelete={deletingId === item.id}
                onEdit={() => {
                  setDeletingId(null);
                  setEditingId(item.id);
                }}
                onCancelEdit={() => setEditingId(null)}
                onUpdate={async (patch) => {
                  if (await onUpdate(item.id, patch)) setEditingId(null);
                }}
                onRequestDelete={() => {
                  setEditingId(null);
                  setDeletingId(item.id);
                }}
                onCancelDelete={() => setDeletingId(null)}
                onConfirmDelete={async () => {
                  if (await onRemove(item.id)) setDeletingId(null);
                }}
              />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function EmptyGlossary() {
  return (
    <div className="rounded-lg border p-6">
      <p className="font-medium">Chưa có thuật ngữ nào</p>
      <p className="text-muted-foreground mt-1 max-w-xl text-sm leading-6">
        Thêm thuật ngữ đầu tiên ở trên để caption nhận đúng tên riêng và cách dịch bạn muốn.
      </p>
    </div>
  );
}

function GlossaryRow({
  item,
  saving,
  editing,
  confirmingDelete,
  onEdit,
  onCancelEdit,
  onUpdate,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  item: GlossaryTerm;
  saving: boolean;
  editing: boolean;
  confirmingDelete: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (patch: UpdateGlossaryTerm) => Promise<void>;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => Promise<void>;
}) {
  const [term, setTerm] = useState(item.term);
  const [translation, setTranslation] = useState(item.translation ?? '');
  const [note, setNote] = useState(item.note ?? '');

  if (editing) {
    return (
      <li className="space-y-4 p-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <Field label="Thuật ngữ" htmlFor={`term-${item.id}`}>
            <Input
              id={`term-${item.id}`}
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              maxLength={120}
            />
          </Field>
          <Field label="Nghĩa tiếng Việt" htmlFor={`translation-${item.id}`}>
            <Input
              id={`translation-${item.id}`}
              value={translation}
              onChange={(event) => setTranslation(event.target.value)}
              maxLength={200}
            />
          </Field>
          <div className="lg:col-span-2">
            <Field label="Ghi chú" htmlFor={`note-${item.id}`}>
              <textarea
                id={`note-${item.id}`}
                className={fieldClass}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                rows={2}
              />
            </Field>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-foreground text-background hover:bg-foreground/90"
            disabled={saving || !term.trim()}
            onClick={() =>
              void onUpdate({
                term,
                translation: translation.trim() || null,
                note: note.trim() || null,
              })
            }
          >
            Lưu thay đổi
          </Button>
          <Button variant="outline" size="sm" disabled={saving} onClick={onCancelEdit}>
            Huỷ
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex min-h-20 items-start justify-between gap-5 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium">{item.term}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {item.translation || 'Chưa có nghĩa tiếng Việt'}
        </p>
        {item.note ? <p className="text-muted-foreground mt-1 text-sm">{item.note}</p> : null}
      </div>
      {confirmingDelete ? (
        <div className="shrink-0 text-right">
          <p className="text-sm font-medium">Xoá thuật ngữ này?</p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={saving} onClick={onCancelDelete}>
              Giữ lại
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={saving}
              onClick={() => void onConfirmDelete()}
            >
              Xoá
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Sửa ${item.term}`}>
            Sửa
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onRequestDelete}
            aria-label={`Xoá ${item.term}`}
          >
            Xoá
          </Button>
        </div>
      )}
    </li>
  );
}

export function GlossaryPage() {
  const { language } = useLanguage();
  const glossary = useGlossary(language);
  return (
    <GlossaryView
      items={glossary.items}
      loading={glossary.loading}
      saving={glossary.saving}
      error={glossary.error}
      onAdd={glossary.add}
      onUpdate={glossary.update}
      onRemove={glossary.remove}
      onRetry={glossary.retry}
    />
  );
}
