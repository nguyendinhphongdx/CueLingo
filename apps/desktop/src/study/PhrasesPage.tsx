import type { Phrase } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { Input } from '@cuelingo/ui/components/input';
import { SpeakButton } from '@cuelingo/ui/components/speak-button';
import { Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { studyApi } from './study-api';
import { confirmPhraseRemoval, usePhrases } from './use-phrases';
import { useLanguage } from '../settings';

export function filterPhrases(phrases: Phrase[], search: string) {
  const normalizedSearch = search.trim().toLocaleLowerCase('vi');
  if (!normalizedSearch) return phrases;
  return phrases.filter(
    (phrase) =>
      phrase.phrase.toLocaleLowerCase('vi').includes(normalizedSearch) ||
      phrase.meaningVi?.toLocaleLowerCase('vi').includes(normalizedSearch),
  );
}

export function PhraseList({
  phrases,
  removingId,
  failedId,
  onRemove,
}: {
  phrases: Phrase[];
  removingId: string | null;
  failedId: string | null;
  onRemove: (phrase: Phrase) => void;
}) {
  if (phrases.length === 0) {
    return (
      <div className="rounded-xl border px-5 py-8">
        <p className="font-medium">Chưa có cụm từ nào</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Lưu cụm từ trong cuộc họp để chúng xuất hiện ở đây.
        </p>
      </div>
    );
  }

  return (
    <ul className="bg-card divide-y overflow-hidden rounded-xl border">
      {phrases.map((phrase) => (
        <li key={phrase.id} className="flex min-h-16 items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{phrase.phrase}</p>
            <p className="text-muted-foreground mt-0.5 truncate text-sm">
              {phrase.meaningVi || 'Chưa có nghĩa tiếng Việt'}
            </p>
            {phrase.inReview ? (
              <span className="mt-1 inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-900 dark:bg-green-950 dark:text-green-100">
                Đang ôn
              </span>
            ) : null}
            {failedId === phrase.id ? (
              <p className="text-destructive mt-1 text-sm" role="alert">
                Không thể xoá cụm từ.
              </p>
            ) : null}
          </div>
          <SpeakButton text={phrase.phrase} loadAudio={studyApi.speak} />
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 shrink-0"
            disabled={removingId === phrase.id}
            onClick={() => onRemove(phrase)}
            aria-label={`${failedId === phrase.id ? 'Thử xoá lại' : 'Xoá'} ${phrase.phrase}`}
          >
            {removingId === phrase.id ? 'Đang xoá…' : failedId === phrase.id ? 'Thử lại' : 'Xoá'}
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function PhrasesPage() {
  const phrases = usePhrases(useLanguage().language);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const filteredPhrases = filterPhrases(phrases.phrases, deferredSearch);

  const requestRemove = (phrase: Phrase) => {
    if (confirmPhraseRemoval(phrase.phrase, (message) => window.confirm(message))) {
      phrases.remove(phrase.id);
    }
  };

  if (phrases.loading) {
    return <p className="text-muted-foreground text-sm">Đang tải cụm từ…</p>;
  }
  if (phrases.listError) {
    return (
      <div className="space-y-3" role="alert">
        <p className="text-destructive text-sm">Không thể tải danh sách cụm từ.</p>
        <Button variant="outline" onClick={() => void phrases.retryList()}>
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <section aria-labelledby="phrase-list-title" className="space-y-4">
      <div>
        <h2 id="phrase-list-title" className="text-sm font-semibold">
          Kho cụm từ
        </h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Những cụm từ bạn đã lưu từ các cuộc họp.
        </p>
      </div>
      {phrases.phrases.length > 0 ? (
        <label className="relative block">
          <span className="sr-only">Tìm cụm từ</span>
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm cụm từ hoặc nghĩa"
            className="h-10 pl-9 shadow-none"
          />
        </label>
      ) : null}
      {filteredPhrases.length === 0 && phrases.phrases.length > 0 ? (
        <div className="rounded-xl border px-5 py-8">
          <p className="font-medium">Không tìm thấy cụm từ</p>
          <p className="text-muted-foreground mt-1 text-sm">Thử một từ khoá khác.</p>
        </div>
      ) : (
        <PhraseList
          phrases={filteredPhrases}
          removingId={phrases.removingId}
          failedId={phrases.failedId}
          onRemove={requestRemove}
        />
      )}
    </section>
  );
}
